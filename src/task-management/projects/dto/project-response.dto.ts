import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import { Project } from '../entities/project.entity';
import { ProjectStatus } from '../../../database/enums';

export class ProjectResponseDto {
  id: number;
  name: string;
  description: string | null;
  ownerId: number;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(project: Project): ProjectResponseDto {
    const dto = new ProjectResponseDto();
    dto.id = project.id;
    dto.name = project.name;
    dto.description = project.description;
    dto.ownerId = project.ownerId;
    dto.status = project.status;
    dto.startDate = project.startDate;
    dto.endDate = project.endDate;
    dto.createdAt = project.createdAt;
    dto.updatedAt = project.updatedAt;
    return dto;
  }
}

export type PaginatedProjectsResponseDto =
  PaginatedResponse<ProjectResponseDto>;
