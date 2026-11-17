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
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { Attachment } from './entities/attachment.entity';

const ATTACHMENT_SELECT = {
  id: true,
  taskId: true,
  uploadedBy: true,
  fileName: true,
  fileUrl: true,
  mimeType: true,
  fileSize: true,
  createdAt: true,
  uploader: USER_SUMMARY_COLUMNS,
} as const;

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentsRepository: Repository<Attachment>,
    private readonly tasksService: TasksService,
    private readonly usersService: UsersService,
  ) {}

  async create(taskId: number, dto: CreateAttachmentDto): Promise<Attachment> {
    await this.ensureTaskExists(taskId);
    if (
      dto.uploadedBy != null &&
      !(await this.usersService.exists(dto.uploadedBy))
    ) {
      throw new BadRequestException(
        `Uploader (user #${dto.uploadedBy}) does not exist`,
      );
    }
    const attachment = this.attachmentsRepository.create({
      taskId,
      uploadedBy: dto.uploadedBy ?? null,
      fileName: dto.fileName,
      fileUrl: dto.fileUrl,
      mimeType: dto.mimeType,
      fileSize: dto.fileSize,
    });
    const saved = await this.saveHandlingConstraints(attachment);
    return this.findOne(taskId, saved.id);
  }

  /** A task's attachments are few, so they are returned unpaginated. */
  async findAll(taskId: number): Promise<Attachment[]> {
    await this.ensureTaskExists(taskId);
    // Uses idx_attachments_task; uploader joined in the same query (no N+1).
    return this.attachmentsRepository.find({
      where: { taskId },
      relations: { uploader: true },
      select: ATTACHMENT_SELECT,
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  async findOne(taskId: number, attachmentId: number): Promise<Attachment> {
    const attachment = await this.attachmentsRepository.findOne({
      where: { id: attachmentId, taskId },
      relations: { uploader: true },
      select: ATTACHMENT_SELECT,
    });
    if (!attachment) {
      await this.ensureTaskExists(taskId);
      throw new NotFoundException(
        `Attachment #${attachmentId} not found on task #${taskId}`,
      );
    }
    return attachment;
  }

  /** Deletes the metadata row only; removing the stored file is the caller's job. */
  async remove(taskId: number, attachmentId: number): Promise<void> {
    const result = await this.attachmentsRepository.delete({
      id: attachmentId,
      taskId,
    });
    if (!result.affected) {
      await this.ensureTaskExists(taskId);
      throw new NotFoundException(
        `Attachment #${attachmentId} not found on task #${taskId}`,
      );
    }
  }

  private async ensureTaskExists(taskId: number): Promise<void> {
    if (!(await this.tasksService.exists(taskId))) {
      throw new NotFoundException(`Task #${taskId} not found`);
    }
  }

  private async saveHandlingConstraints(
    attachment: Attachment,
  ): Promise<Attachment> {
    try {
      return await this.attachmentsRepository.save(attachment);
    } catch (error) {
      const pg = getPgError(error);
      if (pg?.code === PgErrorCode.FOREIGN_KEY_VIOLATION) {
        throw pg.constraint === 'attachments_task_id_fkey'
          ? new NotFoundException(`Task #${attachment.taskId} not found`)
          : new BadRequestException(
              `Uploader (user #${attachment.uploadedBy}) does not exist`,
            );
      }
      if (pg?.code === PgErrorCode.CHECK_VIOLATION) {
        throw new BadRequestException('fileSize must be between 1 B and 10 MB');
      }
      throw error;
    }
  }
}
