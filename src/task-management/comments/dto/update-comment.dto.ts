import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trim } from '../../common/transforms';

export class UpdateCommentDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content: string;
}
