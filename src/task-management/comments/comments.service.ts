import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { USER_SUMMARY_COLUMNS } from '../common/dto/user-summary.dto';
import { getPgError, PgErrorCode } from '../common/pg-error';
import { TasksService } from '../tasks/tasks.service';
import { UsersService } from '../users/users.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListCommentsQueryDto } from './dto/list-comments-query.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Comment } from './entities/comment.entity';

/** Comment columns + a safe author summary (never password_hash). */
const COMMENT_SELECT = {
  id: true,
  taskId: true,
  userId: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  user: USER_SUMMARY_COLUMNS,
} as const;

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
    private readonly tasksService: TasksService,
    private readonly usersService: UsersService,
  ) {}

  async create(taskId: number, dto: CreateCommentDto): Promise<Comment> {
    await this.ensureTaskExists(taskId);
    if (!(await this.usersService.exists(dto.userId))) {
      throw new BadRequestException(`User #${dto.userId} does not exist`);
    }
    const comment = this.commentsRepository.create({
      taskId,
      userId: dto.userId,
      content: dto.content,
    });
    const saved = await this.saveHandlingConstraints(comment);
    return this.findOne(taskId, saved.id);
  }

  async findAll(
    taskId: number,
    query: ListCommentsQueryDto,
  ): Promise<{ items: Comment[]; total: number }> {
    await this.ensureTaskExists(taskId);
    // Uses idx_comments_task; the author is joined in the same query (no N+1).
    const [items, total] = await this.commentsRepository.findAndCount({
      where: { taskId },
      relations: { user: true },
      select: COMMENT_SELECT,
      order: { createdAt: 'ASC', id: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return { items, total };
  }

  async findOne(taskId: number, commentId: number): Promise<Comment> {
    const comment = await this.commentsRepository.findOne({
      where: { id: commentId, taskId },
      relations: { user: true },
      select: COMMENT_SELECT,
    });
    if (!comment) {
      await this.ensureTaskExists(taskId);
      throw new NotFoundException(
        `Comment #${commentId} not found on task #${taskId}`,
      );
    }
    return comment;
  }

  // TODO: once auth exists, only the author (or an admin) may edit/delete.
  async update(
    taskId: number,
    commentId: number,
    dto: UpdateCommentDto,
  ): Promise<Comment> {
    const comment = await this.findOne(taskId, commentId);
    await this.commentsRepository.update(
      { id: comment.id },
      { content: dto.content },
    );
    return this.findOne(taskId, commentId);
  }

  async remove(taskId: number, commentId: number): Promise<void> {
    const result = await this.commentsRepository.delete({
      id: commentId,
      taskId,
    });
    if (!result.affected) {
      await this.ensureTaskExists(taskId);
      throw new NotFoundException(
        `Comment #${commentId} not found on task #${taskId}`,
      );
    }
  }

  private async ensureTaskExists(taskId: number): Promise<void> {
    if (!(await this.tasksService.exists(taskId))) {
      throw new NotFoundException(`Task #${taskId} not found`);
    }
  }

  private async saveHandlingConstraints(comment: Comment): Promise<Comment> {
    try {
      return await this.commentsRepository.save(comment);
    } catch (error) {
      const pg = getPgError(error);
      if (pg?.code === PgErrorCode.FOREIGN_KEY_VIOLATION) {
        throw pg.constraint === 'comments_task_id_fkey'
          ? new NotFoundException(`Task #${comment.taskId} not found`)
          : new BadRequestException(`User #${comment.userId} does not exist`);
      }
      if (pg?.code === PgErrorCode.CHECK_VIOLATION) {
        throw new BadRequestException('content must not be blank');
      }
      throw error;
    }
  }
}
