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
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorResponses } from '../common/decorators/api-error-responses.decorator';
import { AttachmentsService } from './attachments.service';
import { AttachmentResponseDto } from './dto/attachment-response.dto';
import { CreateAttachmentDto } from './dto/create-attachment.dto';

const TASK_ID_PARAM = ApiParam({
  name: 'taskId',
  description: 'ID của task chứa tệp đính kèm.',
  example: 1,
});

const ATTACHMENT_ID_PARAM = ApiParam({
  name: 'attachmentId',
  description: 'ID của tệp đính kèm.',
  example: 1,
});

@ApiTags('Attachments')
@Controller('task-management/tasks/:taskId/attachments')
@TASK_ID_PARAM
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  @ApiOperation({
    summary: 'Đăng ký tệp đính kèm cho task',
    description: [
      'Lưu **metadata** của một tệp đã được tải lên nơi lưu trữ bên ngoài (S3, CDN…). ',
      'API này **không nhận nội dung tệp** (không phải `multipart/form-data`) — chỉ nhận JSON mô tả tệp.',
      '',
      '- `fileName`: tên tệp, được cắt khoảng trắng, tối đa 255 ký tự.',
      '- `fileUrl`: URL hợp lệ trỏ tới tệp.',
      '- `mimeType`: dạng `type/subtype` (vd. `image/png`), được chuyển về chữ thường, tối đa 100 ký tự.',
      '- `fileSize`: kích thước tính bằng byte, từ 1 B đến **10 MB** (10.485.760 byte).',
      '- `uploadedBy` (tuỳ chọn): ID người tải lên, nếu có phải là người dùng đang tồn tại ',
      '  (sẽ lấy từ người dùng đăng nhập khi có xác thực).',
    ].join('\n'),
  })
  @ApiCreatedResponse({
    description:
      'Đăng ký thành công; trả về tệp đính kèm kèm tóm tắt người tải lên (`uploader`).',
    type: AttachmentResponseDto,
  })
  @ApiErrorResponses({
    400: '`taskId` hoặc dữ liệu không hợp lệ (URL sai, MIME type sai định dạng, kích thước ngoài 1 B–10 MB…), hoặc người tải lên không tồn tại.',
    404: 'Không tìm thấy task.',
  })
  async create(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: CreateAttachmentDto,
  ): Promise<AttachmentResponseDto> {
    return AttachmentResponseDto.fromEntity(
      await this.attachmentsService.create(taskId, dto),
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Danh sách tệp đính kèm của task',
    description: [
      'Trả về **toàn bộ** tệp đính kèm của task (không phân trang), theo thứ tự thời gian tải lên (cũ nhất trước). ',
      '`uploader` là `null` nếu không rõ người tải lên hoặc tài khoản đã bị xoá.',
    ].join('\n'),
  })
  @ApiOkResponse({
    description: 'Mảng các tệp đính kèm của task.',
    type: AttachmentResponseDto,
    isArray: true,
  })
  @ApiErrorResponses({
    400: '`taskId` không phải số nguyên hợp lệ.',
    404: 'Không tìm thấy task.',
  })
  async findAll(
    @Param('taskId', ParseIntPipe) taskId: number,
  ): Promise<AttachmentResponseDto[]> {
    const attachments = await this.attachmentsService.findAll(taskId);
    return attachments.map((a) => AttachmentResponseDto.fromEntity(a));
  }

  @Get(':attachmentId')
  @ApiOperation({
    summary: 'Xem chi tiết tệp đính kèm',
    description:
      'Lấy metadata của một tệp đính kèm; tệp phải thuộc task `taskId`.',
  })
  @ATTACHMENT_ID_PARAM
  @ApiOkResponse({
    description: 'Thông tin tệp đính kèm.',
    type: AttachmentResponseDto,
  })
  @ApiErrorResponses({
    400: '`taskId` hoặc `attachmentId` không phải số nguyên hợp lệ.',
    404: 'Không tìm thấy task, hoặc tệp đính kèm không thuộc task.',
  })
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
  @ApiOperation({
    summary: 'Xoá tệp đính kèm',
    description: [
      'Xoá bản ghi metadata của tệp đính kèm khỏi task.',
      '',
      '> Lưu ý: API **chỉ xoá metadata**; việc xoá tệp thực tế trên nơi lưu trữ (S3, CDN…) do phía client/dịch vụ gọi tự xử lý.',
    ].join('\n'),
  })
  @ATTACHMENT_ID_PARAM
  @ApiNoContentResponse({
    description: 'Xoá thành công, không có nội dung trả về.',
  })
  @ApiErrorResponses({
    400: '`taskId` hoặc `attachmentId` không phải số nguyên hợp lệ.',
    404: 'Không tìm thấy task, hoặc tệp đính kèm không thuộc task.',
  })
  async remove(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
  ): Promise<void> {
    await this.attachmentsService.remove(taskId, attachmentId);
  }
}
