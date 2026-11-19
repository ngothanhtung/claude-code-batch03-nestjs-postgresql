import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { RoleName } from '../src/database/enums';
import { createTestApp, grantRoles, resetTestDatabase } from './helpers/e2e';

const { ADMINISTRATORS, MANAGERS, MEMBERS } = RoleName;
const base = '/task-management';

type Method = 'post' | 'put' | 'patch' | 'delete';

/** Every create endpoint → Administrators, Managers. */
const CREATE_ROUTES: [Method, string][] = [
  ['post', `${base}/users`],
  ['post', `${base}/projects`],
  ['post', `${base}/projects/1/members`],
  ['post', `${base}/projects/1/labels`],
  ['post', `${base}/tasks`],
  ['post', `${base}/tasks/1/labels/1`],
  ['post', `${base}/tasks/1/comments`],
  ['post', `${base}/tasks/1/attachments`],
];

/** Every update / delete endpoint → Administrators only. */
const MODIFY_ROUTES: [Method, string][] = [
  ['patch', `${base}/users/1`],
  ['put', `${base}/users/1/roles`],
  ['delete', `${base}/users/1`],
  ['patch', `${base}/projects/1`],
  ['delete', `${base}/projects/1`],
  ['patch', `${base}/projects/1/members/1`],
  ['delete', `${base}/projects/1/members/1`],
  ['patch', `${base}/projects/1/labels/1`],
  ['delete', `${base}/projects/1/labels/1`],
  ['patch', `${base}/tasks/1`],
  ['delete', `${base}/tasks/1`],
  ['put', `${base}/tasks/1/labels`],
  ['delete', `${base}/tasks/1/labels/1`],
  ['patch', `${base}/tasks/1/comments/1`],
  ['delete', `${base}/tasks/1/comments/1`],
  ['delete', `${base}/tasks/1/attachments/1`],
];

describe('RBAC (e2e)', () => {
  let app: INestApplication<App>;
  const tokens: Record<RoleName, string> = {} as Record<RoleName, string>;
  const ids: Record<RoleName, number> = {} as Record<RoleName, number>;

  /** Request as a user whose highest role is `role`. */
  const as = (role: RoleName, method: Method | 'get', url: string) =>
    request(app.getHttpServer())
      [method](url)
      .set('Authorization', `Bearer ${tokens[role]}`);

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
    for (const role of [ADMINISTRATORS, MANAGERS, MEMBERS]) {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: role,
          email: `${role.toLowerCase()}@example.com`,
          password: 'Password123!',
        })
        .expect(201);
      ids[role] = res.body.user.id;
      tokens[role] = res.body.accessToken;
    }
    // Bootstrap the first admin in the DB, then use the API for the rest.
    await grantRoles(app, ids[ADMINISTRATORS], ADMINISTRATORS);
    await as(ADMINISTRATORS, 'put', `${base}/users/${ids[MANAGERS]}/roles`)
      .send({ roles: [MANAGERS] })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists the three fixed roles', async () => {
    const res = await as(MEMBERS, 'get', `${base}/roles`).expect(200);
    expect(res.body.map((r: { name: string }) => r.name)).toEqual([
      ADMINISTRATORS,
      MANAGERS,
      MEMBERS,
    ]);
  });

  it('gives registered users the Members role', async () => {
    const res = await as(MEMBERS, 'get', '/auth/me').expect(200);
    expect(res.body.roles).toEqual([MEMBERS]);
  });

  describe('permission matrix (guards run before validation and lookups)', () => {
    it.each(CREATE_ROUTES)('Members cannot %s %s', (method, url) =>
      as(MEMBERS, method, url).send({}).expect(403),
    );

    it.each(MODIFY_ROUTES)('Members cannot %s %s', (method, url) =>
      as(MEMBERS, method, url).send({}).expect(403),
    );

    it.each(MODIFY_ROUTES)('Managers cannot %s %s', (method, url) =>
      as(MANAGERS, method, url).send({}).expect(403),
    );

    it.each(CREATE_ROUTES)(
      'Managers pass the guard on %s %s',
      async (method, url) => {
        const res = await as(MANAGERS, method, url).send({});
        expect([400, 404]).toContain(res.status); // reached validation / lookup
      },
    );

    it.each([...CREATE_ROUTES, ...MODIFY_ROUTES])(
      'Administrators pass the guard on %s %s',
      async (method, url) => {
        const res = await as(ADMINISTRATORS, method, url).send({});
        expect(res.status).not.toBe(403);
      },
    );
  });

  describe('real flow', () => {
    let project: number;

    it('everyone can read; Managers create; only Administrators update/delete', async () => {
      project = (
        await as(MANAGERS, 'post', `${base}/projects`)
          .send({ name: 'Manager project', ownerId: ids[MANAGERS] })
          .expect(201)
      ).body.id;

      await as(MEMBERS, 'get', `${base}/projects/${project}`).expect(200);
      await as(MEMBERS, 'get', `${base}/projects`).expect(200);

      await as(MANAGERS, 'patch', `${base}/projects/${project}`)
        .send({ name: 'Renamed' })
        .expect(403)
        .expect(({ body }) => expect(body.message).toBe('Insufficient role'));
      await as(ADMINISTRATORS, 'patch', `${base}/projects/${project}`)
        .send({ name: 'Renamed' })
        .expect(200);
      await as(MANAGERS, 'delete', `${base}/projects/${project}`).expect(403);
      await as(ADMINISTRATORS, 'delete', `${base}/projects/${project}`).expect(
        204,
      );
    });

    it('applies role changes immediately, without a new token', async () => {
      await as(MEMBERS, 'post', `${base}/projects`)
        .send({ name: 'Nope', ownerId: ids[MEMBERS] })
        .expect(403);

      const res = await as(
        ADMINISTRATORS,
        'put',
        `${base}/users/${ids[MEMBERS]}/roles`,
      )
        .send({ roles: [MANAGERS] })
        .expect(200);
      expect(res.body.roles).toEqual(
        expect.arrayContaining([MANAGERS, MEMBERS]),
      );

      await as(MEMBERS, 'post', `${base}/projects`)
        .send({ name: 'Now allowed', ownerId: ids[MEMBERS] })
        .expect(201);

      // Revoke again: Members is kept even though it is not sent.
      const revoked = await as(
        ADMINISTRATORS,
        'put',
        `${base}/users/${ids[MEMBERS]}/roles`,
      )
        .send({ roles: [] })
        .expect(200);
      expect(revoked.body.roles).toEqual([MEMBERS]);
      await as(MEMBERS, 'post', `${base}/projects`)
        .send({ name: 'Nope again', ownerId: ids[MEMBERS] })
        .expect(403);
    });

    it('rejects unknown role names', () =>
      as(ADMINISTRATORS, 'put', `${base}/users/${ids[MEMBERS]}/roles`)
        .send({ roles: ['SuperUser'] })
        .expect(400));
  });

  describe('last active administrator', () => {
    const lastAdmin = /last active administrator/;
    const adminUrl = () => `${base}/users/${ids[ADMINISTRATORS]}`;

    it('cannot be demoted, deactivated or deleted', async () => {
      await as(ADMINISTRATORS, 'put', `${adminUrl()}/roles`)
        .send({ roles: [MANAGERS] })
        .expect(409)
        .expect(({ body }) => expect(body.message).toMatch(lastAdmin));
      await as(ADMINISTRATORS, 'patch', adminUrl())
        .send({ isActive: false })
        .expect(409)
        .expect(({ body }) => expect(body.message).toMatch(lastAdmin));
      await as(ADMINISTRATORS, 'delete', adminUrl())
        .expect(409)
        .expect(({ body }) => expect(body.message).toMatch(lastAdmin));
    });

    it('can step down once another administrator exists', async () => {
      await as(ADMINISTRATORS, 'put', `${base}/users/${ids[MANAGERS]}/roles`)
        .send({ roles: [ADMINISTRATORS] })
        .expect(200);
      const res = await as(ADMINISTRATORS, 'put', `${adminUrl()}/roles`)
        .send({ roles: [] })
        .expect(200);
      expect(res.body.roles).toEqual([MEMBERS]);
    });
  });
});
