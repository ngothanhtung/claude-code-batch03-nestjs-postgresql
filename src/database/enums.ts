/**
 * The three fixed system roles — rows of the `roles` table (seeded by the
 * AddRbacRoles migration), NOT a PostgreSQL enum. Values are the `roles.name`.
 * Every user has MEMBERS; it is the baseline granted to any authenticated user.
 */
export enum RoleName {
  ADMINISTRATORS = 'Administrators',
  MANAGERS = 'Managers',
  MEMBERS = 'Members',
}

// PostgreSQL: CREATE TYPE project_status
export enum ProjectStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

// PostgreSQL: CREATE TYPE member_role
export enum MemberRole {
  OWNER = 'owner',
  MANAGER = 'manager',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

// PostgreSQL: CREATE TYPE task_status
export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  REVIEW = 'review',
  DONE = 'done',
}

// PostgreSQL: CREATE TYPE task_priority
export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}
