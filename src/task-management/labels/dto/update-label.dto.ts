import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { trim } from '../../common/transforms';
import { HEX_COLOR } from './create-label.dto';

export class UpdateLabelDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(HEX_COLOR, { message: 'color must be a hex color like #64748B' })
  color?: string;
}
