import { IsEnum, IsOptional } from 'class-validator';
import { MemberRole } from '../../../database/enums';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListProjectMembersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(MemberRole)
  memberRole?: MemberRole;
}
