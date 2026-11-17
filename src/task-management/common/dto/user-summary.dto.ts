import { User } from '../../users/entities/user.entity';

/** Safe public view of a related user — never exposes password_hash. */
export class UserSummaryDto {
  id: number;
  fullName: string;
  email: string;

  static fromEntity(user: User): UserSummaryDto {
    const dto = new UserSummaryDto();
    dto.id = user.id;
    dto.fullName = user.fullName;
    dto.email = user.email;
    return dto;
  }
}

/** TypeORM `select` for a joined user relation: summary columns only. */
export const USER_SUMMARY_COLUMNS = {
  id: true,
  fullName: true,
  email: true,
} as const;
