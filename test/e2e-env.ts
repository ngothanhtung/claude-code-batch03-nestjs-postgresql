// Runs before each e2e test file (jest `setupFiles`): point the app at a
// dedicated test database so e2e runs never touch development data.
import 'dotenv/config';

const base = process.env.DB_NAME ?? 'claude_code_nestjs';
process.env.DB_NAME =
  process.env.DB_NAME_TEST ?? (base.endsWith('_test') ? base : `${base}_test`);
process.env.DB_LOGGING = 'false';
