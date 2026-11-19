import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import { ApiProperty } from '@nestjs/swagger';
import { RoleName } from '../../../database/enums';
import { User } from '../entities/user.entity';

/** Public shape of a user — never exposes password_hash. */
export class UserResponseDto {
  id: number;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  @ApiProperty({
    enum: RoleName,
    enumName: 'RoleName',
    isArray: true,
    example: [RoleName.MEMBERS],
  })
  roles: RoleName[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.fullName = user.fullName;
    dto.email = user.email;
    dto.avatarUrl = user.avatarUrl;
    if (!user.roles) {
      // Guards against silently returning `roles: []` for an unloaded relation.
      throw new Error('UserResponseDto requires user.roles to be loaded');
    }
    dto.roles = user.roles.map((r) => r.name);
    dto.isActive = user.isActive;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    return dto;
  }
}

export type PaginatedUsersResponseDto = PaginatedResponse<UserResponseDto>;
