// Runs before each e2e test file (jest `setupFiles`): point the app at a
// dedicated test database so e2e runs never touch development data.
import 'dotenv/config';

const base = process.env.DB_NAME ?? 'claude_code_nestjs';
process.env.DB_NAME =
  process.env.DB_NAME_TEST ?? (base.endsWith('_test') ? base : `${base}_test`);
process.env.DB_LOGGING = 'false';

// Fallback JWT secrets so e2e runs don't depend on a local .env.
process.env.JWT_ACCESS_SECRET ??= 'e2e-access-secret-0123456789abcdefghijkl';
process.env.JWT_REFRESH_SECRET ??= 'e2e-refresh-secret-0123456789abcdefghijk';
process.env.JWT_ACCESS_TTL = '900';
