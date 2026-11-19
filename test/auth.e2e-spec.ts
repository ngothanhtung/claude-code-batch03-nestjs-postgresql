import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { RoleName } from '../src/database/enums';
import { createTestApp, grantRoles, resetTestDatabase } from './helpers/e2e';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  const api = () => request(app.getHttpServer());
  const credentials = { email: 'auth@example.com', password: 'Password123!' };
  let userId: number;
  let accessToken: string;
  let refreshToken: string;
  /** Updating users is admin-only (RBAC), so these tests use a separate admin. */
  let adminToken: string;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
    const admin = await api()
      .post('/auth/register')
      .send({
        fullName: 'Admin',
        email: 'admin@example.com',
        password: credentials.password,
      })
      .expect(201);
    await grantRoles(app, admin.body.user.id, RoleName.ADMINISTRATORS);
    adminToken = admin.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a member and returns tokens', async () => {
    const res = await api()
      .post('/auth/register')
      .send({ fullName: 'Auth User', ...credentials, role: 'admin' })
      .expect(400); // role is not accepted from input
    expect(res.body.message).toContain('property role should not exist');

    const ok = await api()
      .post('/auth/register')
      .send({ fullName: 'Auth User', ...credentials })
      .expect(201);
    expect(ok.body).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { email: credentials.email, roles: [RoleName.MEMBERS] },
    });
    expect(ok.body.user).not.toHaveProperty('passwordHash');
    userId = ok.body.user.id;
  });

  it('rejects a duplicate registration', () =>
    api()
      .post('/auth/register')
      .send({ fullName: 'Again', ...credentials })
      .expect(409));

  it('logs in (email is case-insensitive)', async () => {
    const res = await api()
      .post('/auth/login')
      .send({ ...credentials, email: 'AUTH@example.com ' })
      .expect(200);
    ({ accessToken, refreshToken } = res.body);
    expect(res.body.user.id).toBe(userId);
  });

  it.each([
    ['wrong password', { ...credentials, password: 'nope-nope' }],
    ['unknown email', { ...credentials, email: 'ghost@example.com' }],
  ])('rejects login with %s using the same message', async (_case, body) => {
    const res = await api().post('/auth/login').send(body).expect(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('protects GET /auth/me', async () => {
    await api().get('/auth/me').expect(401);
    await api()
      .get('/auth/me')
      .set('Authorization', 'Bearer garbage')
      .expect(401);
    await api()
      .get('/auth/me')
      .set('Authorization', `Bearer ${refreshToken}`)
      .expect(401);

    const res = await api()
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body).toMatchObject({ id: userId, email: credentials.email });
  });

  it('refreshes the token pair', async () => {
    await api()
      .post('/auth/refresh')
      .send({ refreshToken: accessToken })
      .expect(401);
    const res = await api()
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    await api()
      .get('/auth/me')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .expect(200);
  });

  it('invalidates existing tokens after a password change', async () => {
    await api()
      .patch(`/task-management/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'NewPassword456!' })
      .expect(200);
    await api()
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
    await api().post('/auth/refresh').send({ refreshToken }).expect(401);
  });

  it('blocks a disabled account', async () => {
    const login = await api()
      .post('/auth/login')
      .send({ ...credentials, password: 'NewPassword456!' })
      .expect(200);
    await api()
      .patch(`/task-management/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
      .expect(200);
    await api()
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(401);
    await api()
      .post('/auth/login')
      .send({ ...credentials, password: 'NewPassword456!' })
      .expect(403);
  });
});
