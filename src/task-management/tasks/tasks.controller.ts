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
import { ApiErrorResponses } from '../common/decorators/api-error-responses.decorator';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';
import { toPaginated } from '../common/dto/paginated-response.dto';
import { LabelResponseDto } from '../labels/dto/label-response.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { SetTaskLabelsDto } from './dto/set-task-labels.dto';
import {
  PaginatedTasksResponseDto,
  TaskResponseDto,
} from './dto/task-response.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskLabelsService } from './task-labels.service';
import { TasksService } from './tasks.service';

const TASK_ID_PARAM = ApiParam({
  name: 'id',
  description: 'ID của task.',
  example: 1,
});

const LABEL_ID_PARAM = ApiParam({
  name: 'labelId',
  description: 'ID của nhãn (phải thuộc cùng dự án với task).',
  example: 1,
});

@ApiTags('Tasks')
@Controller('task-management/tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly taskLabelsService: TaskLabelsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Tạo task mới',
    description: [
      'Tạo một task (hoặc task con) trong dự án `projectId`.',
      '',
      '**Trường bắt buộc:** `projectId`, `title` (tối đa 200 ký tự), `createdBy`.',
      '',
      '**Giá trị mặc định:** `status = todo`, `priority = medium`, `position = 0`.',
      '',
      '**Quy tắc nghiệp vụ:**',
      '- `projectId` và `createdBy` phải tham chiếu tới dự án / người dùng đang tồn tại.',
      '- `parentId` (tạo task con): task cha phải tồn tại và **cùng dự án**.',
      '- `assigneeId`: người được giao phải tồn tại và là **chủ sở hữu hoặc thành viên** của dự án.',
      '- `labelIds` (tối đa 50, trùng lặp được bỏ qua): mọi nhãn phải thuộc cùng dự án; được gắn trong cùng giao dịch với việc tạo task.',
      '- `dueDate` có định dạng `YYYY-MM-DD`.',
      '- `completedAt` do server tự tính: được đặt thời điểm hiện tại nếu `status = done`, ngược lại là `null`.',
    ].join('\n'),
  })
  @ApiCreatedResponse({
    description:
      'Tạo thành công; trả về task kèm danh sách nhãn (sắp xếp theo tên).',
    type: TaskResponseDto,
  })
  @ApiErrorResponses({
    400: 'Dữ liệu không hợp lệ; dự án, người tạo, task cha hoặc người được giao không tồn tại; task cha khác dự án; người được giao không thuộc dự án.',
    404: 'Một hoặc nhiều nhãn trong `labelIds` không thuộc dự án của task.',
  })
  async create(@Body() dto: CreateTaskDto): Promise<TaskResponseDto> {
    return TaskResponseDto.fromEntity(await this.tasksService.create(dto));
  }

  @Get()
  @ApiOperation({
    summary: 'Danh sách task (phân trang, lọc)',
    description: [
      'Trả về danh sách task kèm nhãn, sắp xếp theo `position` rồi `id` tăng dần ',
      '(phù hợp hiển thị bảng Kanban).',
      '',
      '**Bộ lọc (tuỳ chọn, kết hợp theo điều kiện AND):**',
      '- `projectId` — task của một dự án.',
      '- `status` — `todo` | `in_progress` | `review` | `done`.',
      '- `priority` — `low` | `medium` | `high` | `urgent`.',
      '- `assigneeId` — task được giao cho một người dùng (“task của tôi”).',
      '- `parentId` — chỉ các task con **trực tiếp** của một task.',
      '- `dueFrom` / `dueTo` — hạn chót trong khoảng ngày (bao gồm hai đầu, định dạng `YYYY-MM-DD`); có thể dùng riêng lẻ.',
      '',
      'Phân trang bằng `?page=` (mặc định 1) và `?limit=` (mặc định 20, tối đa 100); kết quả bọc trong `{ data, meta }`.',
    ].join('\n'),
  })
  @ApiPaginatedResponse(TaskResponseDto)
  @ApiErrorResponses({
    400: 'Tham số truy vấn không hợp lệ (sai kiểu, sai enum, ngày sai định dạng) hoặc `dueTo` trước `dueFrom`.',
  })
  async findAll(
    @Query() query: ListTasksQueryDto,
  ): Promise<PaginatedTasksResponseDto> {
    const { items, total } = await this.tasksService.findAll(query);
    return toPaginated(items, total, query, (task) =>
      TaskResponseDto.fromEntity(task),
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Xem chi tiết task',
    description:
      'Lấy một task theo `id`, kèm danh sách nhãn đã gắn (sắp xếp theo tên).',
  })
  @TASK_ID_PARAM
  @ApiOkResponse({ description: 'Thông tin task.', type: TaskResponseDto })
  @ApiErrorResponses({
    400: '`id` không phải số nguyên hợp lệ.',
    404: 'Không tìm thấy task.',
  })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TaskResponseDto> {
    return TaskResponseDto.fromEntity(await this.tasksService.findOne(id));
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Cập nhật task',
    description: [
      'Cập nhật **một phần** task; chỉ các trường được gửi lên mới bị thay đổi.',
      '',
      '- `projectId` và `createdBy` **không thể thay đổi**; nhãn được quản lý qua `/tasks/{id}/labels` ',
      '  (gửi các trường này sẽ bị từ chối với lỗi 400).',
      '- Gửi `null` cho `description`, `dueDate`, `parentId`, `assigneeId` để xoá giá trị ',
      '  (vd. `parentId: null` biến task con thành task gốc, `assigneeId: null` để bỏ giao).',
      '- `parentId` mới phải cùng dự án, không được là chính task này hoặc một task con/cháu của nó (tránh vòng lặp).',
      '- `assigneeId` mới phải là chủ sở hữu hoặc thành viên của dự án.',
      '- Đổi `status` sang `done` sẽ đặt `completedAt` = thời điểm hiện tại; đổi sang trạng thái khác sẽ xoá `completedAt`.',
    ].join('\n'),
  })
  @TASK_ID_PARAM
  @ApiOkResponse({
    description:
      'Cập nhật thành công; trả về task sau khi cập nhật (kèm nhãn).',
    type: TaskResponseDto,
  })
  @ApiErrorResponses({
    400: 'Dữ liệu không hợp lệ; task cha không tồn tại / khác dự án / tạo vòng lặp; người được giao không tồn tại hoặc không thuộc dự án.',
    404: 'Không tìm thấy task.',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskResponseDto> {
    return TaskResponseDto.fromEntity(await this.tasksService.update(id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Xoá task',
    description: [
      'Xoá vĩnh viễn task **cùng toàn bộ dữ liệu phụ thuộc** (xoá dây chuyền): ',
      'các task con (đệ quy), bình luận, tệp đính kèm và liên kết nhãn. Bản thân các nhãn không bị xoá.',
    ].join('\n'),
  })
  @TASK_ID_PARAM
  @ApiNoContentResponse({
    description: 'Xoá thành công, không có nội dung trả về.',
  })
  @ApiErrorResponses({
    400: '`id` không phải số nguyên hợp lệ.',
    404: 'Không tìm thấy task.',
  })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.tasksService.remove(id);
  }

  // --- task_labels ---------------------------------------------------------

  @Get(':id/labels')
  @ApiOperation({
    summary: 'Danh sách nhãn của task',
    description:
      'Trả về tất cả nhãn đang gắn với task, sắp xếp theo `name` tăng dần (không phân trang).',
  })
  @TASK_ID_PARAM
  @ApiOkResponse({
    description: 'Mảng các nhãn đang gắn với task.',
    type: LabelResponseDto,
    isArray: true,
  })
  @ApiErrorResponses({
    400: '`id` không phải số nguyên hợp lệ.',
    404: 'Không tìm thấy task.',
  })
  async findLabels(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<LabelResponseDto[]> {
    const labels = await this.taskLabelsService.findAll(id);
    return labels.map((label) => LabelResponseDto.fromEntity(label));
  }

  @Put(':id/labels')
  @ApiOperation({
    summary: 'Thay thế toàn bộ nhãn của task',
    description: [
      'Đặt lại **toàn bộ** tập nhãn của task bằng `labelIds` trong một giao dịch duy nhất: ',
      'nhãn không có trong danh sách sẽ bị gỡ, nhãn mới sẽ được gắn.',
      '',
      '- Gửi `labelIds: []` để gỡ tất cả nhãn.',
      '- Tối đa 50 phần tử; ID trùng lặp được bỏ qua.',
      '- Mọi nhãn phải thuộc cùng dự án với task, nếu không toàn bộ yêu cầu bị từ chối và không có thay đổi nào.',
    ].join('\n'),
  })
  @TASK_ID_PARAM
  @ApiOkResponse({
    description: 'Thành công; trả về tập nhãn mới của task (sắp xếp theo tên).',
    type: LabelResponseDto,
    isArray: true,
  })
  @ApiErrorResponses({
    400: '`id` không hợp lệ, hoặc `labelIds` không phải mảng số nguyên dương / quá 50 phần tử.',
    404: 'Không tìm thấy task, hoặc một số nhãn không thuộc dự án của task.',
  })
  async setLabels(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetTaskLabelsDto,
  ): Promise<LabelResponseDto[]> {
    const labels = await this.taskLabelsService.replace(id, dto.labelIds);
    return labels.map((label) => LabelResponseDto.fromEntity(label));
  }

  @Post(':id/labels/:labelId')
  @ApiOperation({
    summary: 'Gắn một nhãn vào task',
    description:
      'Gắn thêm nhãn `labelId` vào task mà không ảnh hưởng tới các nhãn khác. Nhãn phải thuộc cùng dự án với task.',
  })
  @TASK_ID_PARAM
  @LABEL_ID_PARAM
  @ApiCreatedResponse({
    description:
      'Gắn thành công; trả về toàn bộ nhãn hiện tại của task (sắp xếp theo tên).',
    type: LabelResponseDto,
    isArray: true,
  })
  @ApiErrorResponses({
    400: '`id` hoặc `labelId` không phải số nguyên hợp lệ.',
    404: 'Không tìm thấy task, hoặc nhãn không thuộc dự án của task.',
    409: 'Nhãn đã được gắn với task từ trước.',
  })
  async addLabel(
    @Param('id', ParseIntPipe) id: number,
    @Param('labelId', ParseIntPipe) labelId: number,
  ): Promise<LabelResponseDto[]> {
    const labels = await this.taskLabelsService.add(id, labelId);
    return labels.map((label) => LabelResponseDto.fromEntity(label));
  }

  @Delete(':id/labels/:labelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Gỡ một nhãn khỏi task',
    description:
      'Gỡ nhãn `labelId` khỏi task. Bản thân nhãn vẫn tồn tại trong dự án.',
  })
  @TASK_ID_PARAM
  @LABEL_ID_PARAM
  @ApiNoContentResponse({
    description: 'Gỡ thành công, không có nội dung trả về.',
  })
  @ApiErrorResponses({
    400: '`id` hoặc `labelId` không phải số nguyên hợp lệ.',
    404: 'Không tìm thấy task, hoặc nhãn chưa được gắn với task.',
  })
  async removeLabel(
    @Param('id', ParseIntPipe) id: number,
    @Param('labelId', ParseIntPipe) labelId: number,
  ): Promise<void> {
    await this.taskLabelsService.remove(id, labelId);
  }
}
