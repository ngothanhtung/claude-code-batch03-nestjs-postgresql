import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { databaseConfig } from '../../src/config/database.config';

const TABLES = [
  'attachments',
  'comments',
  'task_labels',
  'labels',
  'tasks',
  'project_members',
  'projects',
  'users',
];

/**
 * Creates the test database if needed, applies all migrations (the same
 * schema path as production — synchronize stays off) and empties every table.
 */
export async function resetTestDatabase(): Promise<void> {
  const config = databaseConfig();
  const database = String(config.database);
  if (!database.endsWith('_test')) {
    throw new Error(`Refusing to reset non-test database "${database}"`);
  }

  // Connect to the maintenance DB to create the test DB on first run.
  const admin = new DataSource({
    ...config,
    database: 'postgres',
    entities: [],
    migrations: [],
  } as typeof config);
  await admin.initialize();
  try {
    const rows: unknown[] = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [database],
    );
    if (rows.length === 0) {
      await admin.query(`CREATE DATABASE "${database}"`);
    }
  } finally {
    await admin.destroy();
  }

  const dataSource = new DataSource({ ...databaseConfig(), entities: [] });
  await dataSource.initialize();
  try {
    await dataSource.runMigrations();
    await dataSource.query(
      `TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`,
    );
  } finally {
    await dataSource.destroy();
  }
}

/** Boots the full AppModule with the same global config as main.ts. */
export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return app;
}
