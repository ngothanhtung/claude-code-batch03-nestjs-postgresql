import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { trim } from '../../common/transforms';

export class CreateCommentDto {
  // TODO: take from the authenticated user once auth is in place.
  @IsInt()
  @IsPositive()
  userId: number;

  /** Trimmed, so whitespace-only content is rejected (chk_comments_content). */
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content: string;
}
