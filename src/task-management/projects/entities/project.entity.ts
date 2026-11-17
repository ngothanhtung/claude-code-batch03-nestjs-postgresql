import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProjectStatus } from '../../../database/enums';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'projects' })
@Check(
  'chk_projects_dates',
  `end_date IS NULL OR start_date IS NULL OR end_date >= start_date`,
)
export class Project {
  @PrimaryGeneratedColumn('increment', {
    type: 'integer',
    primaryKeyConstraintName: 'projects_pkey',
  })
  id: number;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'owner_id', type: 'integer' })
  ownerId: number;

  // A user who owns projects cannot be deleted.
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'owner_id',
    foreignKeyConstraintName: 'projects_owner_id_fkey',
  })
  owner?: User;

  @Column({
    type: 'enum',
    enum: ProjectStatus,
    enumName: 'project_status',
    default: ProjectStatus.ACTIVE,
  })
  status: ProjectStatus;

  // DATE columns are returned by pg as 'YYYY-MM-DD' strings (no timezone shift).
  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
