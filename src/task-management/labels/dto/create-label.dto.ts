import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { trim } from '../../common/transforms';

/** Mirrors chk_labels_color. */
export const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export class CreateLabelDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @IsOptional()
  @Transform(trim)
  @Matches(HEX_COLOR, { message: 'color must be a hex color like #64748B' })
  color?: string;
}
