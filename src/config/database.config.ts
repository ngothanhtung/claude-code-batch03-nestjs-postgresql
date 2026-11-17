import { registerAs } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';

export const databaseConfig = (): DataSourceOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres_password',
  database: process.env.DB_NAME ?? 'claude_code_nestjs',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: false, // schema is managed by migrations only
  logging: process.env.DB_LOGGING === 'true',
});

export default registerAs('database', databaseConfig);
