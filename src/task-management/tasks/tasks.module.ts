import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabelsModule } from '../labels/labels.module';
import { ProjectMembersModule } from '../project-members/project-members.module';
import { ProjectsModule } from '../projects/projects.module';
import { UsersModule } from '../users/users.module';
import { Task } from './entities/task.entity';
import { ProjectTasksController } from './project-tasks.controller';
import { TaskLabelsService } from './task-labels.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { UserTasksController } from './user-tasks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task]),
    ProjectsModule,
    UsersModule,
    ProjectMembersModule,
    LabelsModule,
  ],
  controllers: [TasksController, ProjectTasksController, UserTasksController],
  providers: [TasksService, TaskLabelsService],
  exports: [TasksService],
})
export class TasksModule {}
