import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TaskPriority, TaskStatus } from '../../../database/enums';
import { Label } from '../../labels/entities/label.entity';
import { Project } from '../../projects/entities/project.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'tasks' })
@Index('idx_tasks_project_status', ['projectId', 'status'])
@Index('idx_tasks_assignee', ['assigneeId'])
@Index('idx_tasks_due_date', ['dueDate'])
@Check('chk_tasks_completed', `completed_at IS NULL OR status = 'done'`)
@Check('chk_tasks_position', `position >= 0`)
export class Task {
  @PrimaryGeneratedColumn('increment', {
    type: 'integer',
    primaryKeyConstraintName: 'tasks_pkey',
  })
  id: number;

  @Column({ name: 'project_id', type: 'integer' })
  projectId: number;

  @ManyToOne(() => Project, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'project_id',
    foreignKeyConstraintName: 'tasks_project_id_fkey',
  })
  project?: Project;

  @Column({ name: 'parent_id', type: 'integer', nullable: true })
  parentId: number | null;

  @ManyToOne(() => Task, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'parent_id',
    foreignKeyConstraintName: 'tasks_parent_id_fkey',
  })
  parent?: Task | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: TaskStatus,
    enumName: 'task_status',
    default: TaskStatus.TODO,
  })
  status: TaskStatus;

  @Column({
    type: 'enum',
    enum: TaskPriority,
    enumName: 'task_priority',
    default: TaskPriority.MEDIUM,
  })
  priority: TaskPriority;

  @Column({ name: 'assignee_id', type: 'integer', nullable: true })
  assigneeId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'assignee_id',
    foreignKeyConstraintName: 'tasks_assignee_id_fkey',
  })
  assignee?: User | null;

  @Column({ name: 'created_by', type: 'integer' })
  createdBy: number;

  // A user who created tasks cannot be deleted.
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'created_by',
    foreignKeyConstraintName: 'tasks_created_by_fkey',
  })
  creator?: User;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'integer', default: 0 })
  position: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // task_labels has no entity of its own. Its schema (composite PK, ON DELETE
  // CASCADE, no extra indexes) is owned by the migration, so TypeORM must not
  // diff it — otherwise it adds ON UPDATE CASCADE and per-column indexes.
  @ManyToMany(() => Label)
  @JoinTable({
    name: 'task_labels',
    synchronize: false,
    joinColumn: {
      name: 'task_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'task_labels_task_id_fkey',
    },
    inverseJoinColumn: {
      name: 'label_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'task_labels_label_id_fkey',
    },
  })
  labels?: Label[];
}
