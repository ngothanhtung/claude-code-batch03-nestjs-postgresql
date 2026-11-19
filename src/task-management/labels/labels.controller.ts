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
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CanCreate, CanModify } from '../../auth/decorators/roles.decorator';
import { ApiErrorResponses } from '../common/decorators/api-error-responses.decorator';
import { CreateLabelDto } from './dto/create-label.dto';
import { LabelResponseDto } from './dto/label-response.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { LabelsService } from './labels.service';

const PROJECT_ID_PARAM = ApiParam({
  name: 'projectId',
  description: 'ID của dự án sở hữu nhãn.',
  example: 1,
});

const LABEL_ID_PARAM = ApiParam({
  name: 'labelId',
  description: 'ID của nhãn.',
  example: 1,
});

@ApiTags('Labels')
@Controller('task-management/projects/:projectId/labels')
@PROJECT_ID_PARAM
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Post()
  @CanCreate()
  @ApiOperation({
    summary: 'Tạo nhãn trong dự án',
    description: [
      'Tạo một nhãn (label) mới thuộc dự án. Nhãn được quản lý **theo từng dự án** ',
      'và chỉ gắn được cho task của chính dự án đó.',
      '',
      '- `name` bắt buộc, được cắt khoảng trắng, tối đa 50 ký tự, **duy nhất trong dự án**.',
      '- `color` (tuỳ chọn) là mã màu hex 6 chữ số dạng `#RRGGBB`; mặc định `#64748B`.',
    ].join('\n'),
  })
  @ApiCreatedResponse({
    description: 'Tạo thành công; trả về nhãn vừa tạo.',
    type: LabelResponseDto,
  })
  @ApiErrorResponses({
    400: '`projectId` hoặc dữ liệu không hợp lệ (tên rỗng/quá dài, màu sai định dạng…).',
    404: 'Không tìm thấy dự án.',
    409: 'Dự án đã có nhãn cùng tên.',
  })
  async create(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateLabelDto,
  ): Promise<LabelResponseDto> {
    return LabelResponseDto.fromEntity(
      await this.labelsService.create(projectId, dto),
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Danh sách nhãn của dự án',
    description:
      'Trả về **toàn bộ** nhãn của dự án (không phân trang, vì số lượng nhãn mỗi dự án nhỏ), sắp xếp theo `name` tăng dần.',
  })
  @ApiOkResponse({
    description: 'Mảng các nhãn của dự án.',
    type: LabelResponseDto,
    isArray: true,
  })
  @ApiErrorResponses({
    400: '`projectId` không phải số nguyên hợp lệ.',
    404: 'Không tìm thấy dự án.',
  })
  async findAll(
    @Param('projectId', ParseIntPipe) projectId: number,
  ): Promise<LabelResponseDto[]> {
    const labels = await this.labelsService.findAll(projectId);
    return labels.map((label) => LabelResponseDto.fromEntity(label));
  }

  @Get(':labelId')
  @ApiOperation({
    summary: 'Xem chi tiết nhãn',
    description:
      'Lấy một nhãn theo `labelId`; nhãn phải thuộc dự án `projectId`.',
  })
  @LABEL_ID_PARAM
  @ApiOkResponse({ description: 'Thông tin nhãn.', type: LabelResponseDto })
  @ApiErrorResponses({
    400: '`projectId` hoặc `labelId` không phải số nguyên hợp lệ.',
    404: 'Không tìm thấy dự án, hoặc nhãn không thuộc dự án.',
  })
  async findOne(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('labelId', ParseIntPipe) labelId: number,
  ): Promise<LabelResponseDto> {
    return LabelResponseDto.fromEntity(
      await this.labelsService.findOne(projectId, labelId),
    );
  }

  @Patch(':labelId')
  @CanModify()
  @ApiOperation({
    summary: 'Cập nhật nhãn',
    description:
      'Đổi tên và/hoặc màu của nhãn; chỉ các trường được gửi lên mới bị thay đổi. Tên mới vẫn phải duy nhất trong dự án.',
  })
  @LABEL_ID_PARAM
  @ApiOkResponse({
    description: 'Cập nhật thành công; trả về nhãn sau khi cập nhật.',
    type: LabelResponseDto,
  })
  @ApiErrorResponses({
    400: 'Tham số đường dẫn hoặc dữ liệu không hợp lệ.',
    404: 'Không tìm thấy dự án, hoặc nhãn không thuộc dự án.',
    409: 'Dự án đã có nhãn khác cùng tên.',
  })
  async update(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('labelId', ParseIntPipe) labelId: number,
    @Body() dto: UpdateLabelDto,
  ): Promise<LabelResponseDto> {
    return LabelResponseDto.fromEntity(
      await this.labelsService.update(projectId, labelId, dto),
    );
  }

  @Delete(':labelId')
  @CanModify()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Xoá nhãn',
    description:
      'Xoá vĩnh viễn nhãn khỏi dự án. Nhãn cũng **tự động được gỡ khỏi mọi task** đang gắn nó; bản thân các task không bị xoá.',
  })
  @LABEL_ID_PARAM
  @ApiNoContentResponse({
    description: 'Xoá thành công, không có nội dung trả về.',
  })
  @ApiErrorResponses({
    400: '`projectId` hoặc `labelId` không phải số nguyên hợp lệ.',
    404: 'Không tìm thấy dự án, hoặc nhãn không thuộc dự án.',
  })
  async remove(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('labelId', ParseIntPipe) labelId: number,
  ): Promise<void> {
    await this.labelsService.remove(projectId, labelId);
  }
}
