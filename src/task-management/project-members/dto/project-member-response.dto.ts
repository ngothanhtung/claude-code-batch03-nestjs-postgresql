import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import { ProjectMember } from '../entities/project-member.entity';
import { MemberRole } from '../../../database/enums';

/** Public summary of the member's user — never exposes password_hash. */
export class MemberUserSummaryDto {
  id: number;
  fullName: string;
  email: string;
}

export class ProjectMemberResponseDto {
  id: number;
  projectId: number;
  userId: number;
  memberRole: MemberRole;
  joinedAt: Date;
  user?: MemberUserSummaryDto;

  static fromEntity(member: ProjectMember): ProjectMemberResponseDto {
    const dto = new ProjectMemberResponseDto();
    dto.id = member.id;
    dto.projectId = member.projectId;
    dto.userId = member.userId;
    dto.memberRole = member.memberRole;
    dto.joinedAt = member.joinedAt;
    if (member.user) {
      dto.user = {
        id: member.user.id,
        fullName: member.user.fullName,
        email: member.user.email,
      };
    }
    return dto;
  }
}

export type PaginatedProjectMembersResponseDto =
  PaginatedResponse<ProjectMemberResponseDto>;
