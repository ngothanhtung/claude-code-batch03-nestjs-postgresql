import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TaskPriority, TaskStatus } from '../../../database/enums';
import { trim } from '../../common/transforms';
import { IsDateOnly } from '../../common/validators/date-only.validator';

/**
 * All fields optional; nullable ones accept `null` to clear the value.
 * projectId and createdBy are immutable; labels are managed via /tasks/:id/labels.
 */
export class UpdateTaskDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsInt()
  @IsPositive()
  parentId?: number | null;

  @IsOptional()
  @IsInt()
  @IsPositive()
  assigneeId?: number | null;

  @IsOptional()
  @IsDateOnly()
  dueDate?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
