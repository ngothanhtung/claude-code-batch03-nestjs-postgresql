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
import { ApiTags } from '@nestjs/swagger';
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

@ApiTags('Comments')
@Controller('task-management/tasks/:taskId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  async create(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    return CommentResponseDto.fromEntity(
      await this.commentsService.create(taskId, dto),
    );
  }

  @Get()
  @ApiPaginatedResponse(CommentResponseDto)
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
  async findOne(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
  ): Promise<CommentResponseDto> {
    return CommentResponseDto.fromEntity(
      await this.commentsService.findOne(taskId, commentId),
    );
  }

  @Patch(':commentId')
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
  async remove(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
  ): Promise<void> {
    await this.commentsService.remove(taskId, commentId);
  }
}
