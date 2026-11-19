import { IsJWT } from 'class-validator';

export class RefreshTokenDto {
  /** Refresh token nhận được từ `login` / `register` / `refresh`. */
  @IsJWT()
  refreshToken: string;
}
