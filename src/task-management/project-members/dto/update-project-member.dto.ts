import { IsEnum } from 'class-validator';
import { MemberRole } from '../../../database/enums';

export class UpdateProjectMemberDto {
  @IsEnum(MemberRole)
  memberRole: MemberRole;
}
