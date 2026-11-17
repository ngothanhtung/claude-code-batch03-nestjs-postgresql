import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, resetTestDatabase } from './helpers/e2e';

/**
 * End-to-end flow over every Task Management resource against a real
 * PostgreSQL test database (schema from migrations). Tests in this file run
 * in order and share the ids created along the way.
 */
describe('Task Management (e2e)', () => {
  let app: INestApplication<App>;
  const api = () => request(app.getHttpServer());
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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('setup: users, projects, members', () => {
    it('creates users with the new columns', async () => {
      owner = await createUser('Owner', 'owner@example.com');
      member = await createUser('Member', 'member@example.com');
      outsider = await createUser('Outsider', 'outsider@example.com');

      const res = await api()
        .patch(`${base}/users/${owner}`)
        .send({ role: 'admin', avatarUrl: 'https://cdn.example.com/o.png' })
        .expect(200);
      expect(res.body).toMatchObject({
        role: 'admin',
        isActive: true,
        avatarUrl: 'https://cdn.example.com/o.png',
      });
      expect(res.body).not.toHaveProperty('passwordHash');
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
