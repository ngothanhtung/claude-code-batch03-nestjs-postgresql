import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponses } from '../common/decorators/api-error-responses.decorator';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';
import { toPaginated } from '../common/dto/paginated-response.dto';
import {
  AssignedTaskResponseDto,
  PaginatedAssignedTasksResponseDto,
} from './dto/assigned-task-response.dto';
import { AssignedTasksQueryDto } from './dto/assigned-tasks-query.dto';
import { TasksService } from './tasks.service';

/** User-scoped task views (`/users/:userId/tasks`). */
@ApiTags('Tasks')
@Controller('task-management/users/:userId/tasks')
@ApiParam({
  name: 'userId',
  description:
    'ID của người dùng được giao task (“tôi”). Tạm truyền qua path vì hệ thống chưa có xác thực.',
  example: 1,
})
export class UserTasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({
    summary: 'Danh sách task của tôi (trên mọi dự án)',
    description: [
      'Liệt kê các task được giao cho người dùng `userId` (`assigneeId = userId`) ',
      'trên **tất cả các dự án**, gồm cả task con. Mỗi task kèm danh sách nhãn và ',
      'thông tin tóm tắt của dự án chứa nó (`project: { id, name, status }`).',
      '',
      '**Bộ lọc (tuỳ chọn, kết hợp theo điều kiện AND):**',
      '- Mặc định **ẩn task đã hoàn thành**; gửi `includeDone=true` để lấy cả task `done`.',
      '- `status` — `todo` | `in_progress` | `review` | `done`; khi có thì `includeDone` bị bỏ qua.',
      '- `priority` — `low` | `medium` | `high` | `urgent`.',
      '- `projectId` — chỉ task của một dự án.',
      '',
      '**Sắp xếp:** `dueDate` tăng dần (gần hạn nhất trước, task không có hạn chót ở cuối), ',
      'rồi `priority` giảm dần (`urgent` → `low`), rồi `id`.',
      '',
      'Phân trang bằng `?page=` (mặc định 1) và `?limit=` (mặc định 20, tối đa 100); kết quả bọc trong `{ data, meta }`.',
    ].join('\n'),
  })
  @ApiPaginatedResponse(AssignedTaskResponseDto)
  @ApiErrorResponses({
    400: '`userId` không phải số nguyên hợp lệ, hoặc tham số truy vấn không hợp lệ (sai kiểu, sai enum, `includeDone` không phải `true`/`false`).',
    404: 'Không tìm thấy người dùng.',
  })
  async findAssigned(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: AssignedTasksQueryDto,
  ): Promise<PaginatedAssignedTasksResponseDto> {
    const { items, total } = await this.tasksService.findAssigned(
      userId,
      query,
    );
    return toPaginated(items, total, query, (task) =>
      AssignedTaskResponseDto.fromTask(task),
    );
  }
}
