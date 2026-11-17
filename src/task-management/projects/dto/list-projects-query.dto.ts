import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { ProjectStatus } from '../../../database/enums';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListProjectsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ownerId?: number;
}
