import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RBAC: replaces the `users.role` enum column with `roles` + `user_roles`.
 *
 * Data migration: every existing user gets `Members`; users with
 * `role = 'admin'` also get `Administrators`.
 * `down` restores `users.role` (Administrators → 'admin', everyone else →
 * 'member'); the `Managers` assignments are lost on revert.
 */
export class AddRbacRoles1795564800000 implements MigrationInterface {
  name = 'AddRbacRoles1795564800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE roles (
        id    SERIAL       PRIMARY KEY,
        name  VARCHAR(50)  NOT NULL UNIQUE
      )
    `);
    await queryRunner.query(`
      INSERT INTO roles (name)
      VALUES ('Administrators'), ('Managers'), ('Members')
    `);

    await queryRunner.query(`
      CREATE TABLE user_roles (
        user_id  INTEGER  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        role_id  INTEGER  NOT NULL REFERENCES roles (id) ON DELETE RESTRICT,
        PRIMARY KEY (user_id, role_id)
      )
    `);
    // The PK covers lookups by user_id; this one serves "who has role X".
    await queryRunner.query(
      `CREATE INDEX idx_user_roles_role ON user_roles (role_id)`,
    );

    await queryRunner.query(`
      INSERT INTO user_roles (user_id, role_id)
      SELECT u.id, r.id FROM users u JOIN roles r ON r.name = 'Members'
    `);
    await queryRunner.query(`
      INSERT INTO user_roles (user_id, role_id)
      SELECT u.id, r.id FROM users u JOIN roles r ON r.name = 'Administrators'
      WHERE u.role = 'admin'
    `);

    await queryRunner.query(`ALTER TABLE users DROP COLUMN role`);
    await queryRunner.query(`DROP TYPE user_role`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE user_role AS ENUM ('admin', 'member')`,
    );
    await queryRunner.query(
      `ALTER TABLE users ADD COLUMN role user_role NOT NULL DEFAULT 'member'`,
    );
    await queryRunner.query(`
      UPDATE users SET role = 'admin'
      WHERE id IN (
        SELECT ur.user_id FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE r.name = 'Administrators'
      )
    `);
    await queryRunner.query(`DROP TABLE user_roles`);
    await queryRunner.query(`DROP TABLE roles`);
  }
}
