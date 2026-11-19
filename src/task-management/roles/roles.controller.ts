import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleResponseDto } from './dto/role-response.dto';
import { RolesService } from './roles.service';

@ApiTags('Roles')
@Controller('task-management/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({
    summary: 'Danh sách vai trò hệ thống',
    description: [
      'Ba vai trò cố định:',
      '',
      '- `Administrators` — toàn quyền: tạo, cập nhật, xoá; gán vai trò cho người dùng.',
      '- `Managers` — được **tạo** mới (không được cập nhật / xoá).',
      '- `Members` — vai trò nền của mọi người dùng: chỉ **xem** dữ liệu.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: [RoleResponseDto] })
  async findAll(): Promise<RoleResponseDto[]> {
    const roles = await this.rolesService.findAll();
    return roles.map((role) => RoleResponseDto.fromEntity(role));
  }
}
