import { UserSummaryDto } from '../../common/dto/user-summary.dto';
import { Attachment } from '../entities/attachment.entity';

export class AttachmentResponseDto {
  id: number;
  taskId: number;
  /** null when unknown or the uploader's account was deleted. */
  uploadedBy: number | null;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  createdAt: Date;
  uploader?: UserSummaryDto | null;

  static fromEntity(attachment: Attachment): AttachmentResponseDto {
    const dto = new AttachmentResponseDto();
    dto.id = attachment.id;
    dto.taskId = attachment.taskId;
    dto.uploadedBy = attachment.uploadedBy;
    dto.fileName = attachment.fileName;
    dto.fileUrl = attachment.fileUrl;
    dto.mimeType = attachment.mimeType;
    dto.fileSize = attachment.fileSize;
    dto.createdAt = attachment.createdAt;
    if (attachment.uploader !== undefined) {
      dto.uploader = attachment.uploader
        ? UserSummaryDto.fromEntity(attachment.uploader)
        : null;
    }
    return dto;
  }
}
