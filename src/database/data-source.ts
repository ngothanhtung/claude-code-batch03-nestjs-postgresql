import 'dotenv/config';
import { DataSource } from 'typeorm';
import { databaseConfig } from '../config/database.config';

// Used by the TypeORM CLI for migrations
export default new DataSource(databaseConfig());
