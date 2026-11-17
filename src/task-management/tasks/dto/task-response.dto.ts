import { TaskPriority, TaskStatus } from '../../../database/enums';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import { LabelResponseDto } from '../../labels/dto/label-response.dto';
import { Task } from '../entities/task.entity';

export class TaskResponseDto {
  id: number;
  projectId: number;
  parentId: number | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: number | null;
  createdBy: number;
  dueDate: string | null;
  completedAt: Date | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
  labels?: LabelResponseDto[];

  static fromEntity(task: Task): TaskResponseDto {
    const dto = new TaskResponseDto();
    dto.id = task.id;
    dto.projectId = task.projectId;
    dto.parentId = task.parentId;
    dto.title = task.title;
    dto.description = task.description;
    dto.status = task.status;
    dto.priority = task.priority;
    dto.assigneeId = task.assigneeId;
    dto.createdBy = task.createdBy;
    dto.dueDate = task.dueDate;
    dto.completedAt = task.completedAt;
    dto.position = task.position;
    dto.createdAt = task.createdAt;
    dto.updatedAt = task.updatedAt;
    if (task.labels) {
      dto.labels = task.labels.map((label) =>
        LabelResponseDto.fromEntity(label),
      );
    }
    return dto;
  }
}

export type PaginatedTasksResponseDto = PaginatedResponse<TaskResponseDto>;
