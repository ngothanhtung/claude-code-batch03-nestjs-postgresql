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
  Put,
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
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { SetUserRolesDto } from './dto/set-user-roles.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  PaginatedUsersResponseDto,
  UserResponseDto,
} from './dto/user-response.dto';
import { UsersService } from './users.service';

const USER_ID_PARAM = ApiParam({
  name: 'id',
  description: 'ID của người dùng.',
  example: 1,
});

@ApiTags('Users')
@Controller('task-management/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @CanCreate()
  @ApiOperation({
    summary: 'Tạo người dùng mới',
    description: [
      'Đăng ký một tài khoản người dùng mới.',
      '',
      '- `fullName` được cắt khoảng trắng đầu/cuối, tối đa 100 ký tự.',
      '- `email` được cắt khoảng trắng và **chuyển về chữ thường** trước khi lưu; phải là duy nhất trong hệ thống.',
      '- `password` dài 8–72 ký tự, chỉ lưu dưới dạng **băm (hash)** và không bao giờ được trả về trong response.',
      '- `avatarUrl` (tuỳ chọn) phải là URL hợp lệ.',
      '- Tài khoản mới mặc định có `role = member` và `isActive = true`.',
    ].join('\n'),
  })
  @ApiCreatedResponse({
    description: 'Tạo thành công; trả về thông tin công khai của người dùng.',
    type: UserResponseDto,
  })
  @ApiErrorResponses({
    400: 'Dữ liệu đầu vào không hợp lệ (thiếu trường bắt buộc, email sai định dạng, mật khẩu quá ngắn/dài, có trường không được phép…).',
    409: 'Email đã được sử dụng bởi một tài khoản khác.',
  })
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return UserResponseDto.fromEntity(await this.usersService.create(dto));
  }

  @Get()
  @ApiOperation({
    summary: 'Danh sách người dùng (phân trang)',
    description: [
      'Trả về danh sách người dùng, sắp xếp theo `id` tăng dần.',
      '',
      'Phân trang bằng `?page=` (mặc định 1) và `?limit=` (mặc định 20, tối đa 100). ',
      'Kết quả bọc trong `{ data, meta }`, trong đó `meta` chứa `page`, `limit`, `total`, `totalPages`.',
    ].join('\n'),
  })
  @ApiPaginatedResponse(UserResponseDto)
  @ApiErrorResponses({
    400: 'Tham số phân trang không hợp lệ (`page` < 1, `limit` ngoài khoảng 1–100, hoặc không phải số nguyên).',
  })
  async findAll(
    @Query() query: ListUsersQueryDto,
  ): Promise<PaginatedUsersResponseDto> {
    const { items, total } = await this.usersService.findAll(query);
    return toPaginated(items, total, query, (user) =>
      UserResponseDto.fromEntity(user),
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Xem chi tiết người dùng',
    description: 'Lấy thông tin công khai của một người dùng theo `id`.',
  })
  @USER_ID_PARAM
  @ApiOkResponse({
    description: 'Thông tin người dùng.',
    type: UserResponseDto,
  })
  @ApiErrorResponses({
    400: '`id` không phải số nguyên hợp lệ.',
    404: 'Không tìm thấy người dùng.',
  })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<UserResponseDto> {
    return UserResponseDto.fromEntity(await this.usersService.findOne(id));
  }

  @Patch(':id')
  @CanModify()
  @ApiOperation({
    summary: 'Cập nhật người dùng',
    description: [
      'Cập nhật **một phần** thông tin người dùng; chỉ các trường được gửi lên mới bị thay đổi.',
      '',
      '- Đổi `email`: email mới được chuẩn hoá chữ thường và phải chưa được dùng.',
      '- Đổi `password`: mật khẩu mới được băm lại trước khi lưu.',
      '- Gửi `avatarUrl: null` để xoá ảnh đại diện.',
      '- `isActive: false` khoá tài khoản (token hiện có mất hiệu lực ngay); không thể khoá quản trị viên đang hoạt động cuối cùng.',
      '- Vai trò được đổi qua `PUT /task-management/users/{id}/roles`.',
    ].join('\n'),
  })
  @USER_ID_PARAM
  @ApiOkResponse({
    description: 'Cập nhật thành công; trả về người dùng sau khi cập nhật.',
    type: UserResponseDto,
  })
  @ApiErrorResponses({
    400: '`id` hoặc dữ liệu đầu vào không hợp lệ.',
    404: 'Không tìm thấy người dùng.',
    409: 'Email mới đã được sử dụng, hoặc đang khoá quản trị viên hoạt động cuối cùng.',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return UserResponseDto.fromEntity(await this.usersService.update(id, dto));
  }

  @Put(':id/roles')
  @CanModify()
  @ApiOperation({
    summary: 'Gán vai trò cho người dùng',
    description: [
      '**Thay thế toàn bộ** vai trò của người dùng bằng danh sách gửi lên.',
      '',
      '- `Members` là vai trò nền nên **luôn được giữ**, kể cả khi không gửi.',
      '- Không thể gỡ `Administrators` khỏi quản trị viên đang hoạt động cuối cùng.',
      '- Có hiệu lực ngay ở request kế tiếp (vai trò được đọc từ DB, không nằm trong JWT).',
    ].join('\n'),
  })
  @USER_ID_PARAM
  @ApiOkResponse({
    description: 'Người dùng sau khi cập nhật vai trò.',
    type: UserResponseDto,
  })
  @ApiErrorResponses({
    400: '`id` không hợp lệ hoặc có vai trò không thuộc `Administrators` / `Managers` / `Members`.',
    404: 'Không tìm thấy người dùng.',
    409: 'Đang gỡ `Administrators` khỏi quản trị viên hoạt động cuối cùng.',
  })
  async setRoles(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetUserRolesDto,
  ): Promise<UserResponseDto> {
    return UserResponseDto.fromEntity(
      await this.usersService.setRoles(id, dto),
    );
  }

  @Delete(':id')
  @CanModify()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Xoá người dùng',
    description: [
      'Xoá vĩnh viễn một người dùng.',
      '',
      '**Không thể xoá** nếu người dùng vẫn đang sở hữu dự án hoặc đã tạo task ',
      '(ràng buộc `ON DELETE RESTRICT`) — cần chuyển quyền sở hữu / xử lý dữ liệu đó trước.',
      '',
      'Khi xoá thành công:',
      '- Các bản ghi thành viên dự án của người dùng bị xoá theo.',
      '- Task được giao cho người dùng sẽ trở thành chưa giao (`assigneeId = null`).',
      '- Bình luận và tệp đính kèm vẫn được giữ, nhưng trường tác giả/người tải lên chuyển thành `null`.',
    ].join('\n'),
  })
  @USER_ID_PARAM
  @ApiNoContentResponse({
    description: 'Xoá thành công, không có nội dung trả về.',
  })
  @ApiErrorResponses({
    400: '`id` không phải số nguyên hợp lệ.',
    404: 'Không tìm thấy người dùng.',
    409: 'Người dùng vẫn sở hữu dự án, đã tạo task, hoặc là quản trị viên hoạt động cuối cùng nên không thể xoá.',
  })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.usersService.remove(id);
  }
}
