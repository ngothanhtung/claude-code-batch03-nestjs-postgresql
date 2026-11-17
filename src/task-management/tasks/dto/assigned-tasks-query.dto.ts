import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { TaskPriority, TaskStatus } from '../../../database/enums';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { toBoolean } from '../../common/transforms';

export class AssignedTasksQueryDto extends PaginationQueryDto {
  /**
   * Chỉ lấy task thuộc một dự án.
   * @example 1
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  projectId?: number;

  /** Chỉ lấy task ở một trạng thái (khi có, `includeDone` bị bỏ qua). */
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  /** Chỉ lấy task ở một mức ưu tiên. */
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  /**
   * Có bao gồm task đã hoàn thành (`done`) hay không. Chấp nhận `true` / `false`.
   * @example false
   */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeDone: boolean = false;
}
