import { Module } from '@nestjs/common';
import { AttachmentsModule } from './attachments/attachments.module';
import { CommentsModule } from './comments/comments.module';
import { LabelsModule } from './labels/labels.module';
import { ProjectMembersModule } from './project-members/project-members.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';

/**
 * Task Management feature. Dependency graph (acyclic):
 * users ← projects ← {project-members, labels} ← tasks ← {comments, attachments}
 */
@Module({
  imports: [
    UsersModule,
    ProjectsModule,
    ProjectMembersModule,
    LabelsModule,
    TasksModule,
    CommentsModule,
    AttachmentsModule,
  ],
})
export class TaskManagementModule {}
