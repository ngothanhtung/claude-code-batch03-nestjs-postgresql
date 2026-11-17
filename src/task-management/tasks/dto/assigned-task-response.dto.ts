import { ProjectStatus } from '../../../database/enums';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import { Project } from '../../projects/entities/project.entity';
import { Task } from '../entities/task.entity';
import { TaskResponseDto } from './task-response.dto';

/** Thông tin tóm tắt của dự án chứa task. */
export class ProjectSummaryDto {
  /** @example 1 */
  id: number;
  /** @example "Website" */
  name: string;
  status: ProjectStatus;

  static fromEntity(project: Project): ProjectSummaryDto {
    const dto = new ProjectSummaryDto();
    dto.id = project.id;
    dto.name = project.name;
    dto.status = project.status;
    return dto;
  }
}

export class AssignedTaskResponseDto extends TaskResponseDto {
  /** Dự án chứa task (giúp hiển thị danh sách task trải trên nhiều dự án). */
  project: ProjectSummaryDto;

  /** Requires `task.project` to be loaded. */
  static fromTask(task: Task): AssignedTaskResponseDto {
    return Object.assign(
      new AssignedTaskResponseDto(),
      TaskResponseDto.fromEntity(task),
      { project: ProjectSummaryDto.fromEntity(task.project!) },
    );
  }
}

export type PaginatedAssignedTasksResponseDto =
  PaginatedResponse<AssignedTaskResponseDto>;
