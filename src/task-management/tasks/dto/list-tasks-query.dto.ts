import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { TaskPriority, TaskStatus } from '../../../database/enums';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { IsDateOnly } from '../../common/validators/date-only.validator';

/**
 * Filters map to the indexes in docs/database.md §6:
 * projectId+status (Kanban), assigneeId ("my tasks"), dueFrom/dueTo (due soon).
 */
export class ListTasksQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  projectId?: number;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assigneeId?: number;

  /** Only direct sub-tasks of this task. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parentId?: number;

  @IsOptional()
  @IsDateOnly()
  dueFrom?: string;

  @IsOptional()
  @IsDateOnly()
  dueTo?: string;
}
