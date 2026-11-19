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
import { CanCreate, CanModify } from '../../auth/decorators/roles.decorator';
import { ApiErrorResponses } from '../common/decorators/api-error-responses.decorator';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';
import { toPaginated } from '../common/dto/paginated-response.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { ListProjectMembersQueryDto } from './dto/list-project-members-query.dto';
import {
  PaginatedProjectMembersResponseDto,
  ProjectMemberResponseDto,
} from './dto/project-member-response.dto';
import { UpdateProjectMemberDto } from './dto/update-project-member.dto';
import { ProjectMembersService } from './project-members.service';

const PROJECT_ID_PARAM = ApiParam({
  name: 'projectId',
  description: 'ID của dự án.',
  example: 1,
});

const USER_ID_PARAM = ApiParam({
  name: 'userId',
  description:
    'ID của **người dùng** là thành viên (không phải `id` của bản ghi thành viên).',
  example: 2,
});

@ApiTags('Project members')
@Controller('task-management/projects/:projectId/members')
@PROJECT_ID_PARAM
export class ProjectMembersController {
  constructor(private readonly membersService: ProjectMembersService) {}

  @Post()
  @CanCreate()
  @ApiOperation({
    summary: 'Thêm thành viên vào dự án',
    description: [
      'Thêm một người dùng vào dự án với vai trò `memberRole`.',
      '',
      '- `userId` phải là người dùng đang tồn tại và **chưa** là thành viên của dự án.',
      '- `memberRole` mặc định là `member`; các giá trị: `owner`, `manager`, `member`, `viewer`.',
      '',
      'Chỉ thành viên (hoặc chủ sở hữu dự án) mới có thể được giao task trong dự án.',
    ].join('\n'),
  })
  @ApiCreatedResponse({
    description:
      'Thêm thành công; trả về bản ghi thành viên kèm tóm tắt người dùng.',
    type: ProjectMemberResponseDto,
  })
  @ApiErrorResponses({
    400: '`projectId` hoặc dữ liệu không hợp lệ, hoặc người dùng `userId` không tồn tại.',
    404: 'Không tìm thấy dự án.',
    409: 'Người dùng đã là thành viên của dự án.',
  })
  async add(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: AddProjectMemberDto,
  ): Promise<ProjectMemberResponseDto> {
    return ProjectMemberResponseDto.fromEntity(
      await this.membersService.add(projectId, dto),
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Danh sách thành viên dự án (phân trang, lọc)',
    description: [
      'Trả về các thành viên của dự án, sắp xếp theo thứ tự được thêm vào. ',
      'Mỗi phần tử kèm `user` (tóm tắt: `id`, `fullName`, `email`).',
      '',
      '**Bộ lọc (tuỳ chọn):** `memberRole` — chỉ lấy thành viên có vai trò tương ứng.',
      '',
      'Phân trang bằng `?page=` (mặc định 1) và `?limit=` (mặc định 20, tối đa 100); kết quả bọc trong `{ data, meta }`.',
    ].join('\n'),
  })
  @ApiPaginatedResponse(ProjectMemberResponseDto)
  @ApiErrorResponses({
    400: '`projectId` hoặc tham số truy vấn không hợp lệ.',
    404: 'Không tìm thấy dự án.',
  })
  async findAll(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: ListProjectMembersQueryDto,
  ): Promise<PaginatedProjectMembersResponseDto> {
    const { items, total } = await this.membersService.findAll(
      projectId,
      query,
    );
    return toPaginated(items, total, query, (member) =>
      ProjectMemberResponseDto.fromEntity(member),
    );
  }

  @Get(':userId')
  @ApiOperation({
    summary: 'Xem thông tin thành viên',
    description:
      'Lấy bản ghi thành viên của người dùng `userId` trong dự án (vai trò, ngày tham gia, tóm tắt người dùng).',
  })
  @USER_ID_PARAM
  @ApiOkResponse({
    description: 'Thông tin thành viên.',
    type: ProjectMemberResponseDto,
  })
  @ApiErrorResponses({
    400: '`projectId` hoặc `userId` không phải số nguyên hợp lệ.',
    404: 'Không tìm thấy dự án, hoặc người dùng không phải thành viên của dự án.',
  })
  async findOne(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<ProjectMemberResponseDto> {
    return ProjectMemberResponseDto.fromEntity(
      await this.membersService.findOne(projectId, userId),
    );
  }

  @Patch(':userId')
  @CanModify()
  @ApiOperation({
    summary: 'Đổi vai trò thành viên',
    description:
      'Cập nhật `memberRole` (bắt buộc) của một thành viên trong dự án: `owner`, `manager`, `member` hoặc `viewer`.',
  })
  @USER_ID_PARAM
  @ApiOkResponse({
    description: 'Cập nhật thành công; trả về thành viên với vai trò mới.',
    type: ProjectMemberResponseDto,
  })
  @ApiErrorResponses({
    400: 'Tham số đường dẫn không hợp lệ, hoặc thiếu / sai giá trị `memberRole`.',
    404: 'Không tìm thấy dự án, hoặc người dùng không phải thành viên của dự án.',
  })
  async update(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateProjectMemberDto,
  ): Promise<ProjectMemberResponseDto> {
    return ProjectMemberResponseDto.fromEntity(
      await this.membersService.update(projectId, userId, dto),
    );
  }

  @Delete(':userId')
  @CanModify()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Xoá thành viên khỏi dự án',
    description: [
      'Gỡ người dùng `userId` khỏi danh sách thành viên dự án. Tài khoản người dùng không bị ảnh hưởng.',
      '',
      '> Lưu ý: các task đang giao cho người dùng này **không** tự động bị bỏ giao.',
    ].join('\n'),
  })
  @USER_ID_PARAM
  @ApiNoContentResponse({
    description: 'Xoá thành công, không có nội dung trả về.',
  })
  @ApiErrorResponses({
    400: '`projectId` hoặc `userId` không phải số nguyên hợp lệ.',
    404: 'Không tìm thấy dự án, hoặc người dùng không phải thành viên của dự án.',
  })
  async remove(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<void> {
    await this.membersService.remove(projectId, userId);
  }
}
