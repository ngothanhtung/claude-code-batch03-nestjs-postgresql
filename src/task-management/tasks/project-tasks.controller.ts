import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponses } from '../common/decorators/api-error-responses.decorator';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';
import { toPaginated } from '../common/dto/paginated-response.dto';
import {
  DueSoonTaskResponseDto,
  PaginatedDueSoonTasksResponseDto,
} from './dto/due-soon-task-response.dto';
import {
  DUE_SOON_DEFAULT_DAYS,
  DUE_SOON_MAX_DAYS,
  DueSoonTasksQueryDto,
} from './dto/due-soon-tasks-query.dto';
import { TasksService } from './tasks.service';

/** Project-scoped task views (`/projects/:projectId/tasks/...`). */
@ApiTags('Tasks')
@Controller('task-management/projects/:projectId/tasks')
@ApiParam({
  name: 'projectId',
  description: 'ID của dự án.',
  example: 1,
})
export class ProjectTasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('due-soon')
  @ApiOperation({
    summary: 'Danh sách task sắp hết hạn của dự án',
    description: [
      'Liệt kê các task **chưa hoàn thành** của **toàn bộ dự án** `projectId` (gồm cả task con) ',
      'có hạn chót trong vòng `days` ngày tới.',
      '',
      '**Điều kiện lọc:**',
      `- \`dueDate\` nằm trong khoảng \`[hôm nay, hôm nay + days]\` (bao gồm hai đầu); \`days\` từ 0 tới ${DUE_SOON_MAX_DAYS}, mặc định ${DUE_SOON_DEFAULT_DAYS}.`,
      '- `days = 0` chỉ lấy task hết hạn **hôm nay**.',
      '- Bỏ qua task có `status = done` và task không có `dueDate`.',
      '- Task **đã quá hạn** (`dueDate` trước hôm nay) không nằm trong kết quả — dùng `GET /tasks?dueTo=` để tra cứu.',
      '- “Hôm nay” được tính theo ngày hiện tại của máy chủ.',
      '',
      '**Sắp xếp:** `dueDate` tăng dần (gần hạn nhất trước), rồi `priority` giảm dần (`urgent` → `low`), rồi `id`.',
      '',
      'Mỗi phần tử có thêm trường `daysRemaining` (số ngày còn lại, `0` = hết hạn hôm nay).',
      '',
      'Phân trang bằng `?page=` (mặc định 1) và `?limit=` (mặc định 20, tối đa 100); kết quả bọc trong `{ data, meta }`.',
    ].join('\n'),
  })
  @ApiPaginatedResponse(DueSoonTaskResponseDto)
  @ApiErrorResponses({
    400: `\`projectId\` không phải số nguyên hợp lệ, hoặc \`days\` không phải số nguyên trong khoảng 0–${DUE_SOON_MAX_DAYS}.`,
    404: 'Không tìm thấy dự án.',
  })
  async findDueSoon(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: DueSoonTasksQueryDto,
  ): Promise<PaginatedDueSoonTasksResponseDto> {
    const { items, total } = await this.tasksService.findDueSoon(
      projectId,
      query,
    );
    return toPaginated(items, total, query, ({ task, daysRemaining }) =>
      DueSoonTaskResponseDto.fromTask(task, daysRemaining),
    );
  }
}
