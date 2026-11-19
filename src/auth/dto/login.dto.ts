import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trimLower } from '../../task-management/common/transforms';

export class LoginDto {
  /** @example "an.nguyen@example.com" */
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(255)
  email: string;

  /** @example "Password123!" */
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password: string;
}
