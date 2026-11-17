import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Task } from '../../tasks/entities/task.entity';
import { User } from '../../users/entities/user.entity';

/** 10 MB — mirrors chk_attachments_file_size. */
export const MAX_ATTACHMENT_SIZE = 10485760;

@Entity({ name: 'attachments' })
@Index('idx_attachments_task', ['taskId'])
@Check(
  'chk_attachments_file_size',
  `file_size > 0 AND file_size <= ${MAX_ATTACHMENT_SIZE}`,
)
export class Attachment {
  @PrimaryGeneratedColumn('increment', {
    type: 'integer',
    primaryKeyConstraintName: 'attachments_pkey',
  })
  id: number;

  @Column({ name: 'task_id', type: 'integer' })
  taskId: number;

  @ManyToOne(() => Task, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'task_id',
    foreignKeyConstraintName: 'attachments_task_id_fkey',
  })
  task?: Task;

  @Column({ name: 'uploaded_by', type: 'integer', nullable: true })
  uploadedBy: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'uploaded_by',
    foreignKeyConstraintName: 'attachments_uploaded_by_fkey',
  })
  uploader?: User | null;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'file_url', type: 'text' })
  fileUrl: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ name: 'file_size', type: 'integer' })
  fileSize: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
