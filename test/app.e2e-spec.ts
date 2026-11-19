import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, resetTestDatabase } from './helpers/e2e';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET) requires a JWT like every non-auth route', () => {
    return request(app.getHttpServer()).get('/').expect(401);
  });
});
