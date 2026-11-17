import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { MemberRole } from '../../../database/enums';
import { Project } from '../../projects/entities/project.entity';
import { User } from '../../users/entities/user.entity';

export const PROJECT_MEMBERS_PROJECT_FK = 'project_members_project_id_fkey';

@Entity({ name: 'project_members' })
// A user can be added to a project only once.
@Unique('uq_project_members_project_user', ['projectId', 'userId'])
export class ProjectMember {
  @PrimaryGeneratedColumn('increment', {
    type: 'integer',
    primaryKeyConstraintName: 'project_members_pkey',
  })
  id: number;

  @Column({ name: 'project_id', type: 'integer' })
  projectId: number;

  // Deleting a project removes its member list.
  @ManyToOne(() => Project, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'project_id',
    foreignKeyConstraintName: PROJECT_MEMBERS_PROJECT_FK,
  })
  project?: Project;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  // Deleting a user removes them from all projects.
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'project_members_user_id_fkey',
  })
  user?: User;

  @Column({
    name: 'member_role',
    type: 'enum',
    enum: MemberRole,
    enumName: 'member_role',
    default: MemberRole.MEMBER,
  })
  memberRole: MemberRole;

  @CreateDateColumn({ name: 'joined_at', type: 'timestamptz' })
  joinedAt: Date;
}
