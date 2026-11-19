/**
 * Grants an RBAC role to a user directly in the database — the way to create
 * the first administrator (the API requires an admin to assign roles):
 *
 *   npm run user:grant-role -- <email> <Administrators|Managers|Members>
 */
import dataSource from '../data-source';
import { RoleName } from '../enums';

async function main(): Promise<void> {
  const [email, roleArg] = process.argv.slice(2);
  const role = (Object.values(RoleName) as string[]).includes(roleArg)
    ? (roleArg as RoleName)
    : undefined;
  if (!email || !role) {
    console.error(
      `Usage: npm run user:grant-role -- <email> <${Object.values(RoleName).join('|')}>`,
    );
    process.exit(1);
  }

  await dataSource.initialize();
  try {
    const rows: { user_id: number }[] = await dataSource.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT u.id, r.id FROM users u, roles r
       WHERE u.email = lower($1) AND r.name = $2
       ON CONFLICT DO NOTHING
       RETURNING user_id`,
      [email, role],
    );
    const exists: unknown[] = await dataSource.query(
      `SELECT 1 FROM users WHERE email = lower($1)`,
      [email],
    );
    if (exists.length === 0) {
      console.error(`No user with email ${email}`);
      process.exitCode = 1;
    } else {
      console.log(
        rows.length
          ? `Granted ${role} to ${email}`
          : `${email} already has ${role}`,
      );
    }
  } finally {
    await dataSource.destroy();
  }
}

void main();
