import { registerAs } from '@nestjs/config';

export interface AuthConfig {
  issuer: string;
  accessSecret: string;
  /** Access token lifetime in seconds. */
  accessTtl: number;
  refreshSecret: string;
  /** Refresh token lifetime in seconds. */
  refreshTtl: number;
}

const MIN_SECRET_LENGTH = 32;

function requireSecret(name: string): string {
  const value = process.env[name];
  if (!value || value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `${name} must be set to a random string of at least ${MIN_SECRET_LENGTH} characters`,
    );
  }
  return value;
}

function seconds(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer (seconds)`);
  }
  return value;
}

export const authConfig = (): AuthConfig => {
  const accessSecret = requireSecret('JWT_ACCESS_SECRET');
  const refreshSecret = requireSecret('JWT_REFRESH_SECRET');
  if (accessSecret === refreshSecret) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  }
  return {
    issuer: process.env.JWT_ISSUER ?? 'task-management-api',
    accessSecret,
    accessTtl: seconds('JWT_ACCESS_TTL', 15 * 60),
    refreshSecret,
    refreshTtl: seconds('JWT_REFRESH_TTL', 7 * 24 * 60 * 60),
  };
};

export default registerAs('auth', authConfig);
