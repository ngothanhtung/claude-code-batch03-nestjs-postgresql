import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import { UserSummaryDto } from '../../common/dto/user-summary.dto';
import { Comment } from '../entities/comment.entity';

export class CommentResponseDto {
  id: number;
  taskId: number;
  /** null when the author's account was deleted (ON DELETE SET NULL). */
  userId: number | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  user?: UserSummaryDto | null;

  static fromEntity(comment: Comment): CommentResponseDto {
    const dto = new CommentResponseDto();
    dto.id = comment.id;
    dto.taskId = comment.taskId;
    dto.userId = comment.userId;
    dto.content = comment.content;
    dto.createdAt = comment.createdAt;
    dto.updatedAt = comment.updatedAt;
    if (comment.user !== undefined) {
      dto.user = comment.user ? UserSummaryDto.fromEntity(comment.user) : null;
    }
    return dto;
  }
}

export type PaginatedCommentsResponseDto =
  PaginatedResponse<CommentResponseDto>;
