import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
} from 'class-validator';
import { trim, trimLower } from '../../common/transforms';
import { MAX_ATTACHMENT_SIZE } from '../entities/attachment.entity';

/**
 * Registers a file that is already stored elsewhere (S3, CDN…);
 * the database only keeps its metadata and URL.
 */
export class CreateAttachmentDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;

  @Transform(trim)
  @IsUrl()
  fileUrl: string;

  @Transform(trimLower)
  @MaxLength(100)
  @Matches(/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/, {
    message: 'mimeType must look like type/subtype, e.g. image/png',
  })
  mimeType: string;

  /** Bytes; mirrors chk_attachments_file_size (1 B – 10 MB). */
  @IsInt()
  @IsPositive()
  @Max(MAX_ATTACHMENT_SIZE, { message: 'fileSize must not exceed 10 MB' })
  fileSize: number;

  // TODO: take from the authenticated user once auth is in place.
  @IsOptional()
  @IsInt()
  @IsPositive()
  uploadedBy?: number | null;
}
