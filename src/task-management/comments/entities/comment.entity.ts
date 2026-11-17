import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Task } from '../../tasks/entities/task.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'comments' })
@Index('idx_comments_task', ['taskId'])
@Check('chk_comments_content', `length(trim(content)) > 0`)
export class Comment {
  @PrimaryGeneratedColumn('increment', {
    type: 'integer',
    primaryKeyConstraintName: 'comments_pkey',
  })
  id: number;

  @Column({ name: 'task_id', type: 'integer' })
  taskId: number;

  @ManyToOne(() => Task, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'task_id',
    foreignKeyConstraintName: 'comments_task_id_fkey',
  })
  task?: Task;

  // Comments survive when their author is deleted.
  @Column({ name: 'user_id', type: 'integer', nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'comments_user_id_fkey',
  })
  user?: User | null;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
