import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { AttachmentResponseDto } from './dto/attachment-response.dto';
import { CreateAttachmentDto } from './dto/create-attachment.dto';

@Controller('task-management/tasks/:taskId/attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  async create(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: CreateAttachmentDto,
  ): Promise<AttachmentResponseDto> {
    return AttachmentResponseDto.fromEntity(
      await this.attachmentsService.create(taskId, dto),
    );
  }

  @Get()
  async findAll(
    @Param('taskId', ParseIntPipe) taskId: number,
  ): Promise<AttachmentResponseDto[]> {
    const attachments = await this.attachmentsService.findAll(taskId);
    return attachments.map((a) => AttachmentResponseDto.fromEntity(a));
  }

  @Get(':attachmentId')
  async findOne(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
  ): Promise<AttachmentResponseDto> {
    return AttachmentResponseDto.fromEntity(
      await this.attachmentsService.findOne(taskId, attachmentId),
    );
  }

  @Delete(':attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
  ): Promise<void> {
    await this.attachmentsService.remove(taskId, attachmentId);
  }
}
