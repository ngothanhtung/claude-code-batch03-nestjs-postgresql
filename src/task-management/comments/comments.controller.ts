import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorResponses } from '../common/decorators/api-error-responses.decorator';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';
import { toPaginated } from '../common/dto/paginated-response.dto';
import { CommentsService } from './comments.service';
import {
  CommentResponseDto,
  PaginatedCommentsResponseDto,
} from './dto/comment-response.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListCommentsQueryDto } from './dto/list-comments-query.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

const TASK_ID_PARAM = ApiParam({
  name: 'taskId',
  description: 'ID của task chứa bình luận.',
  example: 1,
});

const COMMENT_ID_PARAM = ApiParam({
  name: 'commentId',
  description: 'ID của bình luận.',
  example: 1,
});

@ApiTags('Comments')
@Controller('task-management/tasks/:taskId/comments')
@TASK_ID_PARAM
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @ApiOperation({
    summary: 'Thêm bình luận vào task',
    description: [
      'Tạo một bình luận mới trên task.',
      '',
      '- `userId`: tác giả bình luận, phải là người dùng đang tồn tại ',
      '  (tạm thời truyền trong body; sẽ lấy từ người dùng đăng nhập khi có xác thực).',
      '- `content`: được cắt khoảng trắng đầu/cuối, không được rỗng, tối đa 10.000 ký tự.',
    ].join('\n'),
  })
  @ApiCreatedResponse({
    description:
      'Tạo thành công; trả về bình luận kèm tóm tắt tác giả (`user`).',
    type: CommentResponseDto,
  })
  @ApiErrorResponses({
    400: '`taskId` hoặc dữ liệu không hợp lệ (nội dung rỗng/quá dài), hoặc người dùng `userId` không tồn tại.',
    404: 'Không tìm thấy task.',
  })
  async create(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    return CommentResponseDto.fromEntity(
      await this.commentsService.create(taskId, dto),
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Danh sách bình luận của task (phân trang)',
    description: [
      'Trả về bình luận của task theo **thứ tự thời gian** (cũ nhất trước), mỗi bình luận kèm tóm tắt tác giả. ',
      '`user` là `null` nếu tài khoản tác giả đã bị xoá.',
      '',
      'Phân trang bằng `?page=` (mặc định 1) và `?limit=` (mặc định 20, tối đa 100); kết quả bọc trong `{ data, meta }`.',
    ].join('\n'),
  })
  @ApiPaginatedResponse(CommentResponseDto)
  @ApiErrorResponses({
    400: '`taskId` hoặc tham số phân trang không hợp lệ.',
    404: 'Không tìm thấy task.',
  })
  async findAll(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Query() query: ListCommentsQueryDto,
  ): Promise<PaginatedCommentsResponseDto> {
    const { items, total } = await this.commentsService.findAll(taskId, query);
    return toPaginated(items, total, query, (comment) =>
      CommentResponseDto.fromEntity(comment),
    );
  }

  @Get(':commentId')
  @ApiOperation({
    summary: 'Xem chi tiết bình luận',
    description:
      'Lấy một bình luận theo `commentId`; bình luận phải thuộc task `taskId`.',
  })
  @COMMENT_ID_PARAM
  @ApiOkResponse({
    description: 'Thông tin bình luận.',
    type: CommentResponseDto,
  })
  @ApiErrorResponses({
    400: '`taskId` hoặc `commentId` không phải số nguyên hợp lệ.',
    404: 'Không tìm thấy task, hoặc bình luận không thuộc task.',
  })
  async findOne(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
  ): Promise<CommentResponseDto> {
    return CommentResponseDto.fromEntity(
      await this.commentsService.findOne(taskId, commentId),
    );
  }

  @Patch(':commentId')
  @ApiOperation({
    summary: 'Sửa nội dung bình luận',
    description: [
      'Thay nội dung (`content`, bắt buộc) của bình luận; `updatedAt` được cập nhật tự động.',
      '',
      '> ⚠️ Hiện chưa có xác thực nên chưa kiểm tra quyền; sau này chỉ tác giả (hoặc admin) mới được sửa.',
    ].join('\n'),
  })
  @COMMENT_ID_PARAM
  @ApiOkResponse({
    description: 'Cập nhật thành công; trả về bình luận sau khi sửa.',
    type: CommentResponseDto,
  })
  @ApiErrorResponses({
    400: 'Tham số đường dẫn không hợp lệ, hoặc `content` rỗng / quá 10.000 ký tự.',
    404: 'Không tìm thấy task, hoặc bình luận không thuộc task.',
  })
  async update(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() dto: UpdateCommentDto,
  ): Promise<CommentResponseDto> {
    return CommentResponseDto.fromEntity(
      await this.commentsService.update(taskId, commentId, dto),
    );
  }

  @Delete(':commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Xoá bình luận',
    description: [
      'Xoá vĩnh viễn một bình luận khỏi task.',
      '',
      '> ⚠️ Hiện chưa có xác thực nên chưa kiểm tra quyền; sau này chỉ tác giả (hoặc admin) mới được xoá.',
    ].join('\n'),
  })
  @COMMENT_ID_PARAM
  @ApiNoContentResponse({
    description: 'Xoá thành công, không có nội dung trả về.',
  })
  @ApiErrorResponses({
    400: '`taskId` hoặc `commentId` không phải số nguyên hợp lệ.',
    404: 'Không tìm thấy task, hoặc bình luận không thuộc task.',
  })
  async remove(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
  ): Promise<void> {
    await this.commentsService.remove(taskId, commentId);
  }
}
