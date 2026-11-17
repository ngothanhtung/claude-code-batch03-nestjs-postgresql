import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline schema — verbatim SQL from docs/database.md §7.
 * Order: ENUM types → parent tables → child tables → indexes.
 */
export class InitTaskManagementSchema1794585600000 implements MigrationInterface {
  name = 'InitTaskManagementSchema1794585600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ENUM types
    await queryRunner.query(
      `CREATE TYPE user_role AS ENUM ('admin', 'member')`,
    );
    await queryRunner.query(
      `CREATE TYPE project_status AS ENUM ('active', 'archived')`,
    );
    await queryRunner.query(
      `CREATE TYPE member_role AS ENUM ('owner', 'manager', 'member', 'viewer')`,
    );
    await queryRunner.query(
      `CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'review', 'done')`,
    );
    await queryRunner.query(
      `CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent')`,
    );

    // users
    await queryRunner.query(`
      CREATE TABLE users (
        id             SERIAL        PRIMARY KEY,
        full_name      VARCHAR(100)  NOT NULL,
        email          VARCHAR(255)  NOT NULL UNIQUE,
        password_hash  VARCHAR(255)  NOT NULL,
        avatar_url     TEXT          NULL,
        role           user_role     NOT NULL DEFAULT 'member',
        is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
        created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `);

    // projects
    await queryRunner.query(`
      CREATE TABLE projects (
        id           SERIAL          PRIMARY KEY,
        name         VARCHAR(150)    NOT NULL,
        description  TEXT            NULL,
        owner_id     INTEGER         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        status       project_status  NOT NULL DEFAULT 'active',
        start_date   DATE            NULL,
        end_date     DATE            NULL,
        created_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_projects_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
      )
    `);

    // project_members
    await queryRunner.query(`
      CREATE TABLE project_members (
        id           SERIAL       PRIMARY KEY,
        project_id   INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id      INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        member_role  member_role  NOT NULL DEFAULT 'member',
        joined_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_project_members_project_user UNIQUE (project_id, user_id)
      )
    `);

    // tasks
    await queryRunner.query(`
      CREATE TABLE tasks (
        id            SERIAL         PRIMARY KEY,
        project_id    INTEGER        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        parent_id     INTEGER        NULL REFERENCES tasks(id) ON DELETE CASCADE,
        title         VARCHAR(200)   NOT NULL,
        description   TEXT           NULL,
        status        task_status    NOT NULL DEFAULT 'todo',
        priority      task_priority  NOT NULL DEFAULT 'medium',
        assignee_id   INTEGER        NULL REFERENCES users(id) ON DELETE SET NULL,
        created_by    INTEGER        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        due_date      DATE           NULL,
        completed_at  TIMESTAMPTZ    NULL,
        position      INTEGER        NOT NULL DEFAULT 0 CONSTRAINT chk_tasks_position CHECK (position >= 0),
        created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_tasks_completed CHECK (completed_at IS NULL OR status = 'done')
      )
    `);

    // labels
    await queryRunner.query(`
      CREATE TABLE labels (
        id          SERIAL       PRIMARY KEY,
        project_id  INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name        VARCHAR(50)  NOT NULL,
        color       CHAR(7)      NOT NULL DEFAULT '#64748B' CONSTRAINT chk_labels_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_labels_project_name UNIQUE (project_id, name)
      )
    `);

    // task_labels
    await queryRunner.query(`
      CREATE TABLE task_labels (
        task_id   INTEGER  NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        label_id  INTEGER  NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
        PRIMARY KEY (task_id, label_id)
      )
    `);

    // comments
    await queryRunner.query(`
      CREATE TABLE comments (
        id          SERIAL       PRIMARY KEY,
        task_id     INTEGER      NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        user_id     INTEGER      NULL REFERENCES users(id) ON DELETE SET NULL,
        content     TEXT         NOT NULL CONSTRAINT chk_comments_content CHECK (length(trim(content)) > 0),
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    // attachments
    await queryRunner.query(`
      CREATE TABLE attachments (
        id           SERIAL        PRIMARY KEY,
        task_id      INTEGER       NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        uploaded_by  INTEGER       NULL REFERENCES users(id) ON DELETE SET NULL,
        file_name    VARCHAR(255)  NOT NULL,
        file_url     TEXT          NOT NULL,
        mime_type    VARCHAR(100)  NOT NULL,
        file_size    INTEGER       NOT NULL CONSTRAINT chk_attachments_file_size CHECK (file_size > 0 AND file_size <= 10485760),
        created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `);

    // Indexes
    await queryRunner.query(
      `CREATE INDEX idx_tasks_project_status ON tasks (project_id, status)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_tasks_assignee ON tasks (assignee_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_tasks_due_date ON tasks (due_date)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_comments_task ON comments (task_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_attachments_task ON attachments (task_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Child tables first; dropping a table also drops its indexes.
    await queryRunner.query(`DROP TABLE attachments`);
    await queryRunner.query(`DROP TABLE comments`);
    await queryRunner.query(`DROP TABLE task_labels`);
    await queryRunner.query(`DROP TABLE labels`);
    await queryRunner.query(`DROP TABLE tasks`);
    await queryRunner.query(`DROP TABLE project_members`);
    await queryRunner.query(`DROP TABLE projects`);
    await queryRunner.query(`DROP TABLE users`);

    await queryRunner.query(`DROP TYPE task_priority`);
    await queryRunner.query(`DROP TYPE task_status`);
    await queryRunner.query(`DROP TYPE member_role`);
    await queryRunner.query(`DROP TYPE project_status`);
    await queryRunner.query(`DROP TYPE user_role`);
  }
}
