import { QueryFailedError } from 'typeorm';

export const PgErrorCode = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  CHECK_VIOLATION: '23514',
} as const;

export interface PgErrorInfo {
  code?: string;
  constraint?: string;
}

/** Extracts the PostgreSQL error code/constraint from a TypeORM query error. */
export function getPgError(error: unknown): PgErrorInfo | undefined {
  if (!(error instanceof QueryFailedError)) return undefined;
  return error.driverError as PgErrorInfo | undefined;
}
