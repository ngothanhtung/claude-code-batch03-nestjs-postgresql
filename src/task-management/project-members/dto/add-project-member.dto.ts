import { IsEnum, IsInt, IsOptional, IsPositive } from 'class-validator';
import { MemberRole } from '../../../database/enums';

export class AddProjectMemberDto {
  @IsInt()
  @IsPositive()
  userId: number;

  @IsOptional()
  @IsEnum(MemberRole)
  memberRole?: MemberRole;
}
