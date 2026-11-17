import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
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

export class CreateTaskDto {
  @IsInt()
  @IsPositive()
  projectId: number;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  description?: string | null;

  /** completedAt is derived from status by the server. */
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  /** Parent task (same project) when creating a sub-task. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  parentId?: number | null;

  /** Must be the project owner or a project member. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  assigneeId?: number | null;

  // TODO: take from the authenticated user once auth is in place.
  @IsInt()
  @IsPositive()
  createdBy: number;

  @IsOptional()
  @IsDateOnly()
  dueDate?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  /** Labels of the same project to attach on creation. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  labelIds?: number[];
}
