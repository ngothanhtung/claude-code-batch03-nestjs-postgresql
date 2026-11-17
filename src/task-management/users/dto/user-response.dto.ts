import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import { UserRole } from '../../../database/enums';
import { User } from '../entities/user.entity';

/** Public shape of a user — never exposes password_hash. */
export class UserResponseDto {
  id: number;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.fullName = user.fullName;
    dto.email = user.email;
    dto.avatarUrl = user.avatarUrl;
    dto.role = user.role;
    dto.isActive = user.isActive;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    return dto;
  }
}

export type PaginatedUsersResponseDto = PaginatedResponse<UserResponseDto>;
