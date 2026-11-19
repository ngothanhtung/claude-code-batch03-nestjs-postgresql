import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trim, trimLower } from '../../common/transforms';

/**
 * All fields optional; `avatarUrl: null` clears the avatar.
 * Roles are changed via `PUT /task-management/users/:id/roles`.
 */
export class UpdateUserDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password?: string;

  @IsOptional()
  @Transform(trim)
  @IsUrl()
  avatarUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
