/**
 * Seeds rich, realistic mock data for the task-management module.
 *
 *   npm run seed
 *
 * - Additive & re-runnable: only rows owned by `@seed.taskflow.vn` users are
 *   touched. Previous seed data is removed first (projects cascade to members,
 *   labels, tasks, comments, attachments), any other data is left alone.
 * - Deterministic content (fixed PRNG seed); dates are relative to today so
 *   "due soon" / "overdue" views always have data.
 * - Runs in one transaction: either everything is seeded or nothing changes.
 */
import { EntityManager } from 'typeorm';
import { Attachment } from '../../task-management/attachments/entities/attachment.entity';
import { Comment } from '../../task-management/comments/entities/comment.entity';
import { Label } from '../../task-management/labels/entities/label.entity';
import { ProjectMember } from '../../task-management/project-members/entities/project-member.entity';
import { Project } from '../../task-management/projects/entities/project.entity';
import { Role } from '../../task-management/roles/entities/role.entity';
import { Task } from '../../task-management/tasks/entities/task.entity';
import { User } from '../../task-management/users/entities/user.entity';
import { PasswordHasher } from '../../task-management/users/password-hasher';
import dataSource from '../data-source';
import {
  MemberRole,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
  RoleName,
} from '../enums';
import {
  ATTACHMENTS,
  COMMENTS,
  PROJECTS,
  SEED_EMAIL_DOMAIN,
  SEED_PASSWORD,
  SeedProject,
  USERS,
} from './task-management.seed-data';

// --- deterministic randomness ------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(20261117);
const int = (min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));
const chance = (p: number) => random() < p;
const pick = <T>(items: readonly T[]): T => items[int(0, items.length - 1)];

function weighted<T>(entries: [T, number][]): T {
  let roll = random() * entries.reduce((sum, [, w]) => sum + w, 0);
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return entries[entries.length - 1][0];
}

// --- dates ---------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date();

/** Local calendar date `offset` days from today, as `YYYY-MM-DD`. */
function dateOnly(offset: number): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A timestamp `days` days ago, at a random working hour. */
function daysAgo(days: number): Date {
  const d = new Date(now.getTime() - days * DAY_MS);
  d.setHours(int(8, 18), int(0, 59), int(0, 59), 0);
  return d > now ? new Date(now.getTime() - int(1, 120) * 60_000) : d;
}

/** A random moment between `from` and now. */
function between(from: Date, to: Date = now): Date {
  return new Date(from.getTime() + random() * (to.getTime() - from.getTime()));
}

// --- seeding -------------------------------------------------------------------

const seedEmail = (key: string) => `${key}@${SEED_EMAIL_DOMAIN}`;

async function removePreviousSeed(m: EntityManager): Promise<number> {
  const rows: { id: number }[] = await m.query(
    `SELECT id FROM users WHERE email LIKE $1`,
    [`%@${SEED_EMAIL_DOMAIN}`],
  );
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return 0;
  // Cascades to members, labels, tasks (+ sub-tasks, comments, attachments).
  await m.query(`DELETE FROM projects WHERE owner_id = ANY($1)`, [ids]);
  // Fails (RESTRICT) if a seed user created tasks in a non-seed project; the
  // whole transaction is then rolled back and nothing is lost.
  await m.query(`DELETE FROM users WHERE id = ANY($1)`, [ids]);
  return ids.length;
}

async function seedUsers(m: EntityManager): Promise<Map<string, User>> {
  const hasher = new PasswordHasher();
  const roles = new Map(
    (await m.getRepository(Role).find()).map((r) => [r.name, r]),
  );
  const rolesFor = (extra: RoleName[] = []) =>
    [RoleName.MEMBERS, ...extra].map((name) => {
      const role = roles.get(name);
      if (!role) throw new Error(`Role ${name} missing — run migrations`);
      return role;
    });
  const users = await m.getRepository(User).save(
    await Promise.all(
      USERS.map(async (u) => {
        const email = seedEmail(u.key);
        const createdAt = daysAgo(int(260, 320));
        return m.getRepository(User).create({
          fullName: u.fullName,
          email,
          passwordHash: await hasher.hash(SEED_PASSWORD),
          avatarUrl: `https://i.pravatar.cc/150?u=${email}`,
          roles: rolesFor(u.roles),
          isActive: !u.inactive,
          createdAt,
          updatedAt: createdAt,
        });
      }),
    ),
  );
  return new Map(USERS.map((u, i) => [u.key, users[i]]));
}

interface Counters {
  projects: number;
  members: number;
  labels: number;
  tasks: number;
  taskLabels: number;
  comments: number;
  attachments: number;
}

const STATUS_WEIGHTS: [TaskStatus, number][] = [
  [TaskStatus.TODO, 30],
  [TaskStatus.IN_PROGRESS, 25],
  [TaskStatus.REVIEW, 15],
  [TaskStatus.DONE, 30],
];

/** Due date offset (days from today) suitable for a task's status. */
function dueOffsetFor(status: TaskStatus, archived: boolean): number | null {
  if (archived) return -int(70, 200);
  if (status === TaskStatus.DONE) return chance(0.8) ? -int(1, 40) : null;
  return weighted<number | null>([
    [-int(1, 12), 15], // overdue
    [int(0, 7), 30], // due soon
    [int(8, 45), 35], // later
    [null, 20], // no due date
  ]);
}

async function seedProject(
  m: EntityManager,
  spec: SeedProject,
  users: Map<string, User>,
  counters: Counters,
): Promise<Project> {
  const user = (key: string) => users.get(key)!;
  const owner = user(spec.owner);
  const archived = spec.status === ProjectStatus.ARCHIVED;
  const projectCreatedAt = daysAgo(-spec.startOffset + int(3, 10));

  const project = await m.getRepository(Project).save(
    m.getRepository(Project).create({
      name: spec.name,
      description: spec.description,
      ownerId: owner.id,
      status: spec.status,
      startDate: dateOnly(spec.startOffset),
      endDate: spec.endOffset === null ? null : dateOnly(spec.endOffset),
      createdAt: projectCreatedAt,
      updatedAt: archived ? daysAgo(-(spec.endOffset ?? 0)) : projectCreatedAt,
    }),
  );
  counters.projects++;

  // --- members (owner is stored too, with the `owner` role) ---
  const memberSpecs: [string, MemberRole][] = [
    [spec.owner, MemberRole.OWNER],
    ...spec.members,
  ];
  await m.getRepository(ProjectMember).save(
    memberSpecs.map(([key, role]) =>
      m.getRepository(ProjectMember).create({
        projectId: project.id,
        userId: user(key).id,
        memberRole: role,
        joinedAt: between(projectCreatedAt, daysAgo(-spec.startOffset)),
      }),
    ),
  );
  counters.members += memberSpecs.length;

  const everyone = memberSpecs.map(([key]) => user(key));
  const assignable = memberSpecs
    .filter(([, role]) => role !== MemberRole.VIEWER)
    .map(([key]) => user(key));
  const creators = memberSpecs
    .filter(([, r]) => r === MemberRole.OWNER || r === MemberRole.MANAGER)
    .map(([key]) => user(key));
  const an = user('an');
  const pickAssignee = (): User | null => {
    if (chance(0.1)) return null;
    // Bias towards the demo user so "my tasks" has plenty of rows.
    if (assignable.includes(an) && chance(0.3)) return an;
    return pick(assignable);
  };

  // --- labels ---
  const labels = await m.getRepository(Label).save(
    spec.labels.map(([name, color]) =>
      m.getRepository(Label).create({
        projectId: project.id,
        name,
        color,
        createdAt: between(projectCreatedAt, daysAgo(-spec.startOffset)),
      }),
    ),
  );
  counters.labels += labels.length;
  const labelByName = new Map(labels.map((l) => [l.name, l]));

  // --- tasks & sub-tasks ---
  const startedAt = daysAgo(Math.max(-spec.startOffset, 1));
  const endedAt = archived ? daysAgo(-(spec.endOffset ?? 0)) : now;
  const buildTask = (
    title: string,
    priority: TaskPriority,
    status: TaskStatus,
    dueOffset: number | null,
    position: number,
    taskLabels: Label[],
    parent: Task | null,
    description: string | null = null,
  ): Task => {
    const createdAt = between(parent?.createdAt ?? startedAt, endedAt);
    const completedAt =
      status === TaskStatus.DONE ? between(createdAt, endedAt) : null;
    const updatedAt = completedAt ?? between(createdAt, endedAt);
    return m.getRepository(Task).create({
      projectId: project.id,
      parentId: parent?.id ?? null,
      title,
      description,
      status,
      priority,
      assigneeId:
        (parent && chance(0.6) ? parent.assigneeId : pickAssignee()?.id) ??
        null,
      createdBy: pick(creators).id,
      dueDate: dueOffset === null ? null : dateOnly(dueOffset),
      completedAt,
      position,
      labels: taskLabels,
      createdAt,
      updatedAt,
    });
  };

  const allTasks: Task[] = [];
  for (const [index, tpl] of spec.tasks.entries()) {
    const status = archived ? TaskStatus.DONE : weighted(STATUS_WEIGHTS);
    const dueOffset = dueOffsetFor(status, archived);
    const tplLabels = (tpl.labels ?? []).map((n) => labelByName.get(n)!);
    const parent = await m
      .getRepository(Task)
      .save(
        buildTask(
          tpl.title,
          tpl.priority,
          status,
          dueOffset,
          index * 10,
          tplLabels,
          null,
          tpl.description ?? null,
        ),
      );
    allTasks.push(parent);

    const subtasks = (tpl.subtasks ?? []).map((title, i) => {
      const subStatus =
        status === TaskStatus.DONE ? TaskStatus.DONE : weighted(STATUS_WEIGHTS);
      // Sub-tasks are due on or a few days before their parent.
      const subDue =
        dueOffset === null
          ? chance(0.5)
            ? null
            : dueOffsetFor(subStatus, archived)
          : dueOffset - int(0, 3);
      return buildTask(
        title,
        pick([TaskPriority.LOW, TaskPriority.MEDIUM, tpl.priority]),
        subStatus,
        subDue,
        i * 10,
        tplLabels.slice(0, 1),
        parent,
      );
    });
    if (subtasks.length) {
      allTasks.push(...(await m.getRepository(Task).save(subtasks)));
    }
  }
  counters.tasks += allTasks.length;
  counters.taskLabels += allTasks.reduce(
    (n, t) => n + (t.labels?.length ?? 0),
    0,
  );

  // --- comments & attachments ---
  const comments: Comment[] = [];
  const attachments: Attachment[] = [];
  for (const task of allTasks) {
    const commentCount =
      task.status === TaskStatus.TODO ? int(0, 1) : int(0, 4);
    const times = Array.from({ length: commentCount }, () =>
      between(task.createdAt, task.completedAt ?? endedAt),
    ).sort((a, b) => a.getTime() - b.getTime());
    for (const createdAt of times) {
      const edited = chance(0.15);
      comments.push(
        m.getRepository(Comment).create({
          taskId: task.id,
          userId: pick(everyone).id,
          content: pick(COMMENTS),
          createdAt,
          updatedAt: edited ? between(createdAt, endedAt) : createdAt,
        }),
      );
    }

    if (chance(0.3)) {
      for (let i = int(1, 2); i > 0; i--) {
        const [fileName, mimeType] = pick(ATTACHMENTS);
        const fileSize = mimeType.startsWith('video/')
          ? int(4_000_000, 10_000_000)
          : int(15_000, 3_500_000);
        attachments.push(
          m.getRepository(Attachment).create({
            taskId: task.id,
            uploadedBy: pick(everyone).id,
            fileName,
            fileUrl: `https://storage.${SEED_EMAIL_DOMAIN}/projects/${project.id}/tasks/${task.id}/${fileName}`,
            mimeType,
            fileSize,
            createdAt: between(task.createdAt, task.completedAt ?? endedAt),
          }),
        );
      }
    }
  }
  await m.getRepository(Comment).save(comments, { chunk: 100 });
  await m.getRepository(Attachment).save(attachments, { chunk: 100 });
  counters.comments += comments.length;
  counters.attachments += attachments.length;

  return project;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed mock data when NODE_ENV=production');
  }
  await dataSource.initialize();
  console.log(`Seeding database "${String(dataSource.options.database)}"…`);

  const counters: Counters = {
    projects: 0,
    members: 0,
    labels: 0,
    tasks: 0,
    taskLabels: 0,
    comments: 0,
    attachments: 0,
  };
  const { users, projects, removed } = await dataSource.transaction(
    async (m) => {
      const removed = await removePreviousSeed(m);
      const users = await seedUsers(m);
      const projects: Project[] = [];
      for (const spec of PROJECTS) {
        projects.push(await seedProject(m, spec, users, counters));
      }
      return { users, projects, removed };
    },
  );

  if (removed) console.log(`Removed previous seed (${removed} users + data).`);
  console.table({ users: users.size, ...counters });
  console.log(`Login: <user>@${SEED_EMAIL_DOMAIN} / ${SEED_PASSWORD}`);
  console.log('Users:');
  for (const u of users.values()) console.log(`  #${u.id}  ${u.fullName}`);
  console.log('Projects:');
  for (const p of projects) console.log(`  #${p.id}  ${p.name} (${p.status})`);
  const an = users.get('an')!;
  console.log(
    `Try: GET /task-management/users/${an.id}/tasks  ·  ` +
      `GET /task-management/projects/${projects[0].id}/tasks/due-soon?days=7`,
  );
}

void main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => dataSource.isInitialized && dataSource.destroy());
