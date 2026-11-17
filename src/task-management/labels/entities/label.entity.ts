import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';

@Entity({ name: 'labels' })
@Unique('uq_labels_project_name', ['projectId', 'name'])
@Check('chk_labels_color', `color ~ '^#[0-9A-Fa-f]{6}$'`)
export class Label {
  @PrimaryGeneratedColumn('increment', {
    type: 'integer',
    primaryKeyConstraintName: 'labels_pkey',
  })
  id: number;

  @Column({ name: 'project_id', type: 'integer' })
  projectId: number;

  @ManyToOne(() => Project, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'project_id',
    foreignKeyConstraintName: 'labels_project_id_fkey',
  })
  project?: Project;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'char', length: 7, default: '#64748B' })
  color: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
