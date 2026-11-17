import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { ProjectStatus } from '../../../database/enums';
import { IsDateOnly } from '../../common/validators/date-only.validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * All fields optional. Nullable columns (description, startDate, endDate)
 * accept `null` to clear the value; `@IsOptional` skips validation for null.
 */
export class UpdateProjectDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsInt()
  @IsPositive()
  ownerId?: number;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsDateOnly()
  startDate?: string | null;

  @IsOptional()
  @IsDateOnly()
  endDate?: string | null;
}
