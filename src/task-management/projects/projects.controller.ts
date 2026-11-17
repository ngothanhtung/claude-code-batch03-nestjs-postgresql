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
import { CreateProjectDto } from './dto/create-project.dto';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';
import {
  PaginatedProjectsResponseDto,
  ProjectResponseDto,
} from './dto/project-response.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

const PROJECT_ID_PARAM = ApiParam({
  name: 'id',
  description: 'ID của dự án.',
  example: 1,
});

@ApiTags('Projects')
@Controller('task-management/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({
    summary: 'Tạo dự án mới',
    description: [
      'Tạo một dự án mới do người dùng `ownerId` sở hữu.',
      '',
      '- `name` bắt buộc, được cắt khoảng trắng, tối đa 150 ký tự.',
      '- `ownerId` phải là ID của một người dùng đang tồn tại.',
      '- `status` mặc định là `active` (giá trị khác: `archived`).',
      '- `startDate`, `endDate` (tuỳ chọn) có định dạng `YYYY-MM-DD`; `endDate` không được trước `startDate`.',
      '',
      'Chủ sở hữu **không** tự động được thêm vào danh sách thành viên, nhưng vẫn luôn được phép nhận giao task của dự án.',
    ].join('\n'),
  })
  @ApiCreatedResponse({
    description: 'Tạo thành công; trả về dự án vừa tạo.',
    type: ProjectResponseDto,
  })
  @ApiErrorResponses({
    400: 'Dữ liệu không hợp lệ, chủ sở hữu (`ownerId`) không tồn tại, hoặc `endDate` trước `startDate`.',
  })
  async create(@Body() dto: CreateProjectDto): Promise<ProjectResponseDto> {
    return ProjectResponseDto.fromEntity(
      await this.projectsService.create(dto),
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Danh sách dự án (phân trang, lọc)',
    description: [
      'Trả về danh sách dự án, sắp xếp theo `id` tăng dần.',
      '',
      '**Bộ lọc (tuỳ chọn, kết hợp được với nhau):**',
      '- `status` — chỉ lấy dự án `active` hoặc `archived`.',
      '- `ownerId` — chỉ lấy dự án của một chủ sở hữu.',
      '',
      'Phân trang bằng `?page=` (mặc định 1) và `?limit=` (mặc định 20, tối đa 100); kết quả bọc trong `{ data, meta }`.',
    ].join('\n'),
  })
  @ApiPaginatedResponse(ProjectResponseDto)
  @ApiErrorResponses({
    400: 'Tham số truy vấn không hợp lệ (phân trang sai, `status` không thuộc enum, `ownerId` không phải số nguyên dương).',
  })
  async findAll(
    @Query() query: ListProjectsQueryDto,
  ): Promise<PaginatedProjectsResponseDto> {
    const { items, total } = await this.projectsService.findAll(query);
    return toPaginated(items, total, query, (project) =>
      ProjectResponseDto.fromEntity(project),
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Xem chi tiết dự án',
    description: 'Lấy thông tin của một dự án theo `id`.',
  })
  @PROJECT_ID_PARAM
  @ApiOkResponse({ description: 'Thông tin dự án.', type: ProjectResponseDto })
  @ApiErrorResponses({
    400: '`id` không phải số nguyên hợp lệ.',
    404: 'Không tìm thấy dự án.',
  })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ProjectResponseDto> {
    return ProjectResponseDto.fromEntity(
      await this.projectsService.findOne(id),
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Cập nhật dự án',
    description: [
      'Cập nhật **một phần** thông tin dự án; chỉ các trường được gửi lên mới bị thay đổi.',
      '',
      '- Gửi `null` cho `description`, `startDate`, `endDate` để xoá giá trị.',
      '- Khoảng ngày được kiểm tra trên **kết quả sau khi gộp** với dữ liệu hiện có, ',
      '  nên chỉ gửi `endDate` mà sớm hơn `startDate` đang lưu cũng bị từ chối.',
      '- Đổi `ownerId` để chuyển quyền sở hữu; người dùng mới phải tồn tại.',
      '- Đặt `status = archived` để lưu trữ dự án.',
    ].join('\n'),
  })
  @PROJECT_ID_PARAM
  @ApiOkResponse({
    description: 'Cập nhật thành công; trả về dự án sau khi cập nhật.',
    type: ProjectResponseDto,
  })
  @ApiErrorResponses({
    400: '`id` hoặc dữ liệu không hợp lệ, chủ sở hữu mới không tồn tại, hoặc `endDate` trước `startDate`.',
    404: 'Không tìm thấy dự án.',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    return ProjectResponseDto.fromEntity(
      await this.projectsService.update(id, dto),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Xoá dự án',
    description: [
      'Xoá vĩnh viễn một dự án **cùng toàn bộ dữ liệu liên quan** (xoá dây chuyền — `ON DELETE CASCADE`):',
      'thành viên, nhãn, task (kể cả task con) và bình luận, tệp đính kèm của các task đó.',
      '',
      '> ⚠️ Thao tác không thể hoàn tác. Cân nhắc dùng `PATCH` với `status = archived` nếu chỉ muốn ẩn dự án.',
    ].join('\n'),
  })
  @PROJECT_ID_PARAM
  @ApiNoContentResponse({
    description: 'Xoá thành công, không có nội dung trả về.',
  })
  @ApiErrorResponses({
    400: '`id` không phải số nguyên hợp lệ.',
    404: 'Không tìm thấy dự án.',
  })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.projectsService.remove(id);
  }
}
