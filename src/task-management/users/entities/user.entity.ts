import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../../roles/entities/role.entity';

// Constraint names match the PostgreSQL defaults produced by docs/database.md §7.
@Entity({ name: 'users' })
@Unique('users_email_key', ['email'])
export class User {
  @PrimaryGeneratedColumn('increment', {
    type: 'integer',
    primaryKeyConstraintName: 'users_pkey',
  })
  id: number;

  @Column({ name: 'full_name', type: 'varchar', length: 100 })
  fullName: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  /**
   * RBAC roles. Not eager: load explicitly (`relations: { roles: true }`) where
   * needed so users joined from tasks/projects/comments stay cheap.
   * Like task_labels, the join table's schema is owned by the migration.
   */
  @ManyToMany(() => Role)
  @JoinTable({
    name: 'user_roles',
    synchronize: false,
    joinColumn: {
      name: 'user_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'user_roles_user_id_fkey',
    },
    inverseJoinColumn: {
      name: 'role_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'user_roles_role_id_fkey',
    },
  })
  roles?: Role[];
}
