import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../task-management/users/dto/user-response.dto';

export class AuthTokensDto {
  /** JWT gửi kèm header `Authorization: Bearer <accessToken>`. */
  accessToken: string;

  /** JWT dài hạn, chỉ dùng để gọi `POST /auth/refresh`. */
  refreshToken: string;

  @ApiProperty({ enum: ['Bearer'], example: 'Bearer' })
  tokenType: 'Bearer';

  /**
   * Thời gian sống của access token (giây).
   * @example 900
   */
  expiresIn: number;
}

export class AuthResponseDto extends AuthTokensDto {
  user: UserResponseDto;
}
