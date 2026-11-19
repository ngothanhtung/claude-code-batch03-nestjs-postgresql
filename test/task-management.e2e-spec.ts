import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { RoleName } from '../src/database/enums';
import { createTestApp, grantRoles, resetTestDatabase } from './helpers/e2e';

/**
 * End-to-end flow over every Task Management resource against a real
 * PostgreSQL test database (schema from migrations). Tests in this file run
 * in order and share the ids created along the way.
 */
describe('Task Management (e2e)', () => {
  let app: INestApplication<App>;
  /** Unauthenticated client. */
  const anonymous = () => request(app.getHttpServer());
  /** Client that sends the owner's access token on every request. */
  let agent: ReturnType<typeof request.agent>;
  const api = () => agent;
  const base = '/task-management';

  // ids created during the flow
  let owner: number;
  let member: number;
  let outsider: number;
  let project: number;
  let otherProject: number;
  let bug: number;
  let ui: number;
  let foreignLabel: number;
  let task: number;
  let subtask: number;
  let comment: number;
  let attachment: number;

  const createUser = async (fullName: string, email: string) => {
    const res = await api()
      .post(`${base}/users`)
      .send({ fullName, email, password: 'Password123!' })
      .expect(201);
    return res.body.id as number;
  };

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();

    // Every endpoint except register/login/refresh requires a JWT, so the
    // first user signs up through /auth/register, is made an administrator
    // (directly in the DB, like `npm run user:grant-role`) and its token is
    // reused. RBAC rules themselves are covered by rbac.e2e-spec.ts.
    const res = await anonymous()
      .post('/auth/register')
      .send({
        fullName: 'Owner',
        email: 'owner@example.com',
        password: 'Password123!',
      })
      .expect(201);
    owner = res.body.user.id;
    await grantRoles(app, owner, RoleName.ADMINISTRATORS);
    agent = request
      .agent(app.getHttpServer())
      .set('Authorization', `Bearer ${res.body.accessToken}`);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('setup: users, projects, members', () => {
    it('creates users with the new columns', async () => {
      member = await createUser('Member', 'member@example.com');
      outsider = await createUser('Outsider', 'outsider@example.com');

      const res = await api()
        .patch(`${base}/users/${owner}`)
        .send({ avatarUrl: 'https://cdn.example.com/o.png' })
        .expect(200);
      expect(res.body).toMatchObject({
        roles: expect.arrayContaining([
          RoleName.ADMINISTRATORS,
          RoleName.MEMBERS,
        ]) as unknown,
        isActive: true,
        avatarUrl: 'https://cdn.example.com/o.png',
      });
      expect(res.body).not.toHaveProperty('passwordHash');

      // A second admin, so deleting `owner` below hits the FK RESTRICT rule
      // rather than the last-active-administrator protection.
      await api()
        .put(`${base}/users/${outsider}/roles`)
        .send({ roles: [RoleName.ADMINISTRATORS] })
        .expect(200);
    });

    it('requires a JWT on every task-management endpoint', async () => {
      const routes = [
        anonymous().get(`${base}/users`),
        anonymous().post(`${base}/users`).send({}),
        anonymous().get(`${base}/projects`),
        anonymous().get(`${base}/projects/1/members`),
        anonymous().get(`${base}/projects/1/labels`),
        anonymous().get(`${base}/projects/1/tasks/due-soon`),
        anonymous().get(`${base}/tasks`),
        anonymous().get(`${base}/tasks/1/comments`),
        anonymous().get(`${base}/tasks/1/attachments`),
        anonymous().get(`${base}/users/1/tasks`),
      ];
      for (const req of routes) {
        await req.expect(401);
      }
    });

    it('creates projects and adds a member', async () => {
      project = (
        await api()
          .post(`${base}/projects`)
          .send({ name: 'Website', ownerId: owner })
          .expect(201)
      ).body.id;
      otherProject = (
        await api()
          .post(`${base}/projects`)
          .send({ name: 'Other', ownerId: owner })
          .expect(201)
      ).body.id;
      await api()
        .post(`${base}/projects/${project}/members`)
        .send({ userId: member })
        .expect(201);
    });
  });

  describe('labels', () => {
    const labels = () => `${base}/projects/${project}/labels`;

    it('creates labels, applying the default color', async () => {
      const res = await api()
        .post(labels())
        .send({ name: 'Bug', color: '#DC2626' })
        .expect(201);
      bug = res.body.id;

      const uiRes = await api().post(labels()).send({ name: 'UI' }).expect(201);
      ui = uiRes.body.id;
      expect(uiRes.body.color).toBe('#64748B');

      foreignLabel = (
        await api()
          .post(`${base}/projects/${otherProject}/labels`)
          .send({ name: 'Foreign' })
          .expect(201)
      ).body.id;
    });

    it('rejects a duplicate name in the same project (409)', async () => {
      await api().post(labels()).send({ name: 'Bug' }).expect(409);
    });

    it('allows the same name in another project', async () => {
      await api()
        .post(`${base}/projects/${otherProject}/labels`)
        .send({ name: 'Bug' })
        .expect(201);
    });

    it('rejects an invalid color (400)', async () => {
      const res = await api()
        .post(labels())
        .send({ name: 'X', color: 'red' })
        .expect(400);
      expect(res.body.message).toEqual([
        'color must be a hex color like #64748B',
      ]);
    });

    it('lists labels sorted by name and updates one', async () => {
      const res = await api().get(labels()).expect(200);
      expect(res.body.map((l: { name: string }) => l.name)).toEqual([
        'Bug',
        'UI',
      ]);
      await api()
        .patch(`${labels()}/${ui}`)
        .send({ color: '#2563EB' })
        .expect(200)
        .expect(({ body }) => expect(body.color).toBe('#2563EB'));
    });

    it('does not expose a label through another project (404)', async () => {
      await api()
        .get(`${base}/projects/${otherProject}/labels/${bug}`)
        .expect(404);
    });

    it('returns 404 for labels of a missing project', async () => {
      await api().get(`${base}/projects/999999/labels`).expect(404);
    });
  });

  describe('tasks', () => {
    it('creates a task with labels', async () => {
      const res = await api()
        .post(`${base}/tasks`)
        .send({
          projectId: project,
          title: '  Home page  ',
          createdBy: owner,
          assigneeId: member,
          priority: 'high',
          dueDate: '2026-11-20',
          labelIds: [ui, bug],
        })
        .expect(201);
      task = res.body.id;
      expect(res.body).toMatchObject({
        title: 'Home page',
        status: 'todo',
        priority: 'high',
        assigneeId: member,
        position: 0,
        completedAt: null,
      });
      expect(res.body.labels.map((l: { name: string }) => l.name)).toEqual([
        'Bug',
        'UI',
      ]);
    });

    it('creates a sub-task', async () => {
      const res = await api()
        .post(`${base}/tasks`)
        .send({
          projectId: project,
          title: 'Header',
          createdBy: owner,
          parentId: task,
        })
        .expect(201);
      subtask = res.body.id;
      expect(res.body.parentId).toBe(task);
    });

    it.each([
      [
        'an assignee outside the project',
        () => ({ assigneeId: outsider }),
        400,
        /not a member of project/,
      ],
      [
        'a label from another project',
        () => ({ labelIds: [foreignLabel] }),
        404,
        /not found in project/,
      ],
      [
        'a parent from another project',
        () => ({ projectId: otherProject, parentId: task }),
        400,
        /same project/,
      ],
      [
        'a negative position',
        () => ({ position: -1 }),
        400,
        /position must not be less than 0/,
      ],
      [
        'a malformed due date',
        () => ({ dueDate: '2026-02-30' }),
        400,
        /dueDate/,
      ],
    ])('rejects %s', async (_case, extra, status, message) => {
      const res = await api()
        .post(`${base}/tasks`)
        .send({ projectId: project, title: 'x', createdBy: owner, ...extra() })
        .expect(status);
      expect(JSON.stringify(res.body.message)).toMatch(message);
    });

    it('rejects unknown fields such as completedAt (whitelist)', async () => {
      await api()
        .post(`${base}/tasks`)
        .send({
          projectId: project,
          title: 'x',
          createdBy: owner,
          completedAt: '2026-01-01T00:00:00Z',
        })
        .expect(400);
    });

    it('prevents parent cycles', async () => {
      await api()
        .patch(`${base}/tasks/${task}`)
        .send({ parentId: subtask })
        .expect(400)
        .expect(({ body }) => expect(body.message).toMatch(/cycle/));
      await api()
        .patch(`${base}/tasks/${task}`)
        .send({ parentId: task })
        .expect(400);
    });

    it('derives completedAt from status', async () => {
      const done = await api()
        .patch(`${base}/tasks/${task}`)
        .send({ status: 'done' })
        .expect(200);
      expect(done.body.completedAt).toEqual(expect.any(String));

      const reopened = await api()
        .patch(`${base}/tasks/${task}`)
        .send({ status: 'review' })
        .expect(200);
      expect(reopened.body.completedAt).toBeNull();
    });

    it('filters the list (Kanban, sub-tasks, due range)', async () => {
      await api()
        .get(`${base}/tasks`)
        .query({ projectId: project, status: 'review' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.meta.total).toBe(1);
          expect(body.data[0].id).toBe(task);
        });
      await api()
        .get(`${base}/tasks`)
        .query({ parentId: task })
        .expect(200)
        .expect(({ body }) =>
          expect(body.data.map((t: { id: number }) => t.id)).toEqual([subtask]),
        );
      await api()
        .get(`${base}/tasks`)
        .query({
          assigneeId: member,
          dueFrom: '2026-11-01',
          dueTo: '2026-11-30',
        })
        .expect(200)
        .expect(({ body }) => expect(body.meta.total).toBe(1));
      await api()
        .get(`${base}/tasks`)
        .query({ dueFrom: '2026-12-01', dueTo: '2026-11-01' })
        .expect(400);
    });

    it('paginates correctly while loading labels', async () => {
      for (let i = 1; i <= 4; i++) {
        await api()
          .post(`${base}/tasks`)
          .send({
            projectId: otherProject,
            title: `t${i}`,
            createdBy: owner,
            position: i,
            labelIds: [foreignLabel],
          })
          .expect(201);
      }
      const page2 = await api()
        .get(`${base}/tasks`)
        .query({ projectId: otherProject, page: 2, limit: 3 })
        .expect(200);
      expect(page2.body.meta).toEqual({
        page: 2,
        limit: 3,
        total: 4,
        totalPages: 2,
      });
      expect(page2.body.data.map((t: { title: string }) => t.title)).toEqual([
        't4',
      ]);
    });

    it('unassigns with null', async () => {
      await api()
        .patch(`${base}/tasks/${task}`)
        .send({ assigneeId: null })
        .expect(200)
        .expect(({ body }) => expect(body.assigneeId).toBeNull());
    });
  });

  describe('due-soon tasks of a project', () => {
    let dueProject: number;
    const dueSoon = () => `${base}/projects/${dueProject}/tasks/due-soon`;

    /** Server-local date `offset` days from today, as `YYYY-MM-DD`. */
    const inDays = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0'),
      ].join('-');
    };

    beforeAll(async () => {
      dueProject = (
        await api()
          .post(`${base}/projects`)
          .send({ name: 'Deadlines', ownerId: owner })
          .expect(201)
      ).body.id;
      const tasks = [
        { title: 'overdue', dueDate: inDays(-1) },
        { title: 'today', dueDate: inDays(0), priority: 'low' },
        { title: 'today-urgent', dueDate: inDays(0), priority: 'urgent' },
        { title: 'in-3', dueDate: inDays(3) },
        { title: 'in-3-done', dueDate: inDays(3), status: 'done' },
        { title: 'in-10', dueDate: inDays(10) },
        { title: 'no-due' },
      ];
      for (const t of tasks) {
        await api()
          .post(`${base}/tasks`)
          .send({ projectId: dueProject, createdBy: owner, ...t })
          .expect(201);
      }
    });

    it('lists unfinished tasks due within n days, most urgent first', async () => {
      const res = await api().get(dueSoon()).query({ days: 3 }).expect(200);
      expect(
        res.body.data.map((t: { title: string; daysRemaining: number }) => [
          t.title,
          t.daysRemaining,
        ]),
      ).toEqual([
        ['today-urgent', 0],
        ['today', 0],
        ['in-3', 3],
      ]);
      expect(res.body.meta).toEqual({
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1,
      });
    });

    it('defaults to 7 days and supports days=0 and pagination', async () => {
      await api()
        .get(dueSoon())
        .expect(200)
        .expect(({ body }) => expect(body.meta.total).toBe(3));
      await api()
        .get(dueSoon())
        .query({ days: 0 })
        .expect(200)
        .expect(({ body }) => expect(body.meta.total).toBe(2));
      await api()
        .get(dueSoon())
        .query({ days: 30, page: 2, limit: 3 })
        .expect(200)
        .expect(({ body }) =>
          expect(body.data.map((t: { title: string }) => t.title)).toEqual([
            'in-10',
          ]),
        );
    });

    it('validates days and the project', async () => {
      for (const days of ['-1', '366', 'abc', '1.5']) {
        await api().get(dueSoon()).query({ days }).expect(400);
      }
      await api().get(`${base}/projects/999999/tasks/due-soon`).expect(404);
      await api().get(`${base}/projects/abc/tasks/due-soon`).expect(400);
    });
  });

  describe('my tasks across projects', () => {
    let me: number;
    let alpha: number;
    let beta: number;
    const myTasks = () => `${base}/users/${me}/tasks`;
    const titles = (body: { data: { title: string }[] }) =>
      body.data.map((t) => t.title);

    beforeAll(async () => {
      me = await createUser('Me', 'me@example.com');
      const createProject = async (name: string) => {
        const id = (
          await api()
            .post(`${base}/projects`)
            .send({ name, ownerId: owner })
            .expect(201)
        ).body.id as number;
        await api()
          .post(`${base}/projects/${id}/members`)
          .send({ userId: me })
          .expect(201);
        return id;
      };
      alpha = await createProject('Alpha');
      beta = await createProject('Beta');

      const tasks = [
        { projectId: alpha, title: 'a-later', dueDate: '2030-02-01' },
        { projectId: beta, title: 'b-no-due', priority: 'urgent' },
        {
          projectId: beta,
          title: 'b-soon',
          dueDate: '2030-01-01',
          priority: 'high',
        },
        { projectId: alpha, title: 'a-soon', dueDate: '2030-01-01' },
        { projectId: alpha, title: 'a-done', status: 'done' },
      ];
      for (const t of tasks) {
        await api()
          .post(`${base}/tasks`)
          .send({ createdBy: owner, assigneeId: me, ...t })
          .expect(201);
      }
      // Not assigned to me: must never show up.
      await api()
        .post(`${base}/tasks`)
        .send({ projectId: alpha, title: 'not-mine', createdBy: owner })
        .expect(201);
    });

    it('lists my unfinished tasks from all projects, nearest due first', async () => {
      const res = await api().get(myTasks()).expect(200);
      expect(titles(res.body)).toEqual([
        'b-soon',
        'a-soon',
        'a-later',
        'b-no-due',
      ]);
      expect(res.body.meta.total).toBe(4);
      expect(res.body.data[0]).toMatchObject({
        assigneeId: me,
        projectId: beta,
        project: { id: beta, name: 'Beta', status: 'active' },
        labels: [],
      });
    });

    it('filters by includeDone, status, priority and project', async () => {
      await api()
        .get(myTasks())
        .query({ includeDone: 'true' })
        .expect(200)
        .expect(({ body }) => expect(body.meta.total).toBe(5));
      await api()
        .get(myTasks())
        .query({ status: 'done' })
        .expect(200)
        .expect(({ body }) => expect(titles(body)).toEqual(['a-done']));
      await api()
        .get(myTasks())
        .query({ priority: 'urgent' })
        .expect(200)
        .expect(({ body }) => expect(titles(body)).toEqual(['b-no-due']));
      await api()
        .get(myTasks())
        .query({ projectId: alpha, page: 2, limit: 1 })
        .expect(200)
        .expect(({ body }) => {
          expect(titles(body)).toEqual(['a-later']);
          expect(body.meta).toMatchObject({ total: 2, totalPages: 2 });
        });
    });

    it('validates the query and the user', async () => {
      for (const query of [
        { includeDone: 'yes' },
        { status: 'blocked' },
        { projectId: 0 },
      ]) {
        await api().get(myTasks()).query(query).expect(400);
      }
      await api().get(`${base}/users/999999/tasks`).expect(404);
      await api().get(`${base}/users/abc/tasks`).expect(400);
    });
  });

  describe('task labels', () => {
    const taskLabels = () => `${base}/tasks/${subtask}/labels`;
    const names = (body: { name: string }[]) => body.map((l) => l.name);

    it('replaces, adds and removes labels', async () => {
      await api()
        .put(taskLabels())
        .send({ labelIds: [ui] })
        .expect(200)
        .expect(({ body }) => expect(names(body)).toEqual(['UI']));

      await api()
        .post(`${taskLabels()}/${bug}`)
        .expect(201)
        .expect(({ body }) => expect(names(body)).toEqual(['Bug', 'UI']));

      await api().post(`${taskLabels()}/${bug}`).expect(409);
      await api().post(`${taskLabels()}/${foreignLabel}`).expect(404);

      await api().delete(`${taskLabels()}/${bug}`).expect(204);
      await api().delete(`${taskLabels()}/${bug}`).expect(404);

      await api()
        .put(taskLabels())
        .send({ labelIds: [] })
        .expect(200)
        .expect(({ body }) => expect(body).toEqual([]));
    });
  });

  describe('comments', () => {
    const comments = () => `${base}/tasks/${task}/comments`;

    it('creates a trimmed comment with an author summary', async () => {
      const res = await api()
        .post(comments())
        .send({ userId: member, content: '  Header done  ' })
        .expect(201);
      comment = res.body.id;
      expect(res.body.content).toBe('Header done');
      expect(res.body.user).toEqual({
        id: member,
        fullName: 'Member',
        email: 'member@example.com',
      });
    });

    it('rejects whitespace-only content', async () => {
      await api()
        .post(comments())
        .send({ userId: member, content: '   ' })
        .expect(400);
    });

    it('lists, edits and scopes comments to their task', async () => {
      await api()
        .get(comments())
        .expect(200)
        .expect(({ body }) => expect(body.meta.total).toBe(1));
      await api()
        .patch(`${comments()}/${comment}`)
        .send({ content: 'Edited' })
        .expect(200)
        .expect(({ body }) => expect(body.content).toBe('Edited'));
      await api()
        .get(`${base}/tasks/${subtask}/comments/${comment}`)
        .expect(404);
      await api().get(`${base}/tasks/999999/comments`).expect(404);
    });
  });

  describe('attachments', () => {
    const attachments = () => `${base}/tasks/${task}/attachments`;
    const file = {
      fileName: 'home-v2.png',
      fileUrl: 'https://cdn.example.com/home-v2.png',
      mimeType: 'image/png',
      fileSize: 248000,
    };

    it('registers an attachment', async () => {
      const res = await api()
        .post(attachments())
        .send({ ...file, uploadedBy: member })
        .expect(201);
      attachment = res.body.id;
      expect(res.body.uploader).toMatchObject({ id: member });
    });

    it('enforces the 10 MB limit and field formats', async () => {
      await api()
        .post(attachments())
        .send({ ...file, fileSize: 10485761 })
        .expect(400);
      const res = await api()
        .post(attachments())
        .send({ ...file, fileUrl: 'nope', mimeType: 'png' })
        .expect(400);
      expect(res.body.message).toHaveLength(2);
    });

    it('lists attachments', async () => {
      await api()
        .get(attachments())
        .expect(200)
        .expect(({ body }) => expect(body).toHaveLength(1));
    });
  });

  describe('ON DELETE rules', () => {
    it('blocks deleting a project owner (RESTRICT)', async () => {
      await api()
        .delete(`${base}/users/${owner}`)
        .expect(409)
        .expect(({ body }) => expect(body.message).toMatch(/owns projects/));
    });

    it('blocks deleting a task creator who owns no project (RESTRICT)', async () => {
      const creator = await createUser('Creator', 'creator@example.com');
      await api()
        .post(`${base}/tasks`)
        .send({ projectId: project, title: 'by creator', createdBy: creator })
        .expect(201);
      await api()
        .delete(`${base}/users/${creator}`)
        .expect(409)
        .expect(({ body }) => expect(body.message).toMatch(/created tasks/));
    });

    it('nulls author/uploader when a member is deleted (SET NULL)', async () => {
      await api().delete(`${base}/users/${member}`).expect(204);
      await api()
        .get(`${base}/tasks/${task}/comments/${comment}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.userId).toBeNull();
          expect(body.user).toBeNull();
        });
      await api()
        .get(`${base}/tasks/${task}/attachments/${attachment}`)
        .expect(200)
        .expect(({ body }) => expect(body.uploadedBy).toBeNull());
      await api()
        .get(`${base}/projects/${project}/members`)
        .expect(200)
        .expect(({ body }) => expect(body.meta.total).toBe(0));
    });

    it('cascades a task delete to sub-tasks, comments and attachments', async () => {
      await api().delete(`${base}/tasks/${task}`).expect(204);
      await api().get(`${base}/tasks/${subtask}`).expect(404);
      await api().get(`${base}/tasks/${task}/comments`).expect(404);
    });

    it('cascades a project delete to its tasks and labels', async () => {
      await api().delete(`${base}/projects/${otherProject}`).expect(204);
      await api()
        .get(`${base}/tasks`)
        .query({ projectId: otherProject })
        .expect(200)
        .expect(({ body }) => expect(body.meta.total).toBe(0));
      await api().get(`${base}/projects/${otherProject}/labels`).expect(404);
    });
  });
});
