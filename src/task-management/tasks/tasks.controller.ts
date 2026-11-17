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
import { ApiTags } from '@nestjs/swagger';
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

@ApiTags('Tasks')
@Controller('task-management/tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly taskLabelsService: TaskLabelsService,
  ) {}

  @Post()
  async create(@Body() dto: CreateTaskDto): Promise<TaskResponseDto> {
    return TaskResponseDto.fromEntity(await this.tasksService.create(dto));
  }

  @Get()
  @ApiPaginatedResponse(TaskResponseDto)
  async findAll(
    @Query() query: ListTasksQueryDto,
  ): Promise<PaginatedTasksResponseDto> {
    const { items, total } = await this.tasksService.findAll(query);
    return toPaginated(items, total, query, (task) =>
      TaskResponseDto.fromEntity(task),
    );
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TaskResponseDto> {
    return TaskResponseDto.fromEntity(await this.tasksService.findOne(id));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskResponseDto> {
    return TaskResponseDto.fromEntity(await this.tasksService.update(id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.tasksService.remove(id);
  }

  // --- task_labels ---------------------------------------------------------

  @Get(':id/labels')
  async findLabels(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<LabelResponseDto[]> {
    const labels = await this.taskLabelsService.findAll(id);
    return labels.map((label) => LabelResponseDto.fromEntity(label));
  }

  @Put(':id/labels')
  async setLabels(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetTaskLabelsDto,
  ): Promise<LabelResponseDto[]> {
    const labels = await this.taskLabelsService.replace(id, dto.labelIds);
    return labels.map((label) => LabelResponseDto.fromEntity(label));
  }

  @Post(':id/labels/:labelId')
  async addLabel(
    @Param('id', ParseIntPipe) id: number,
    @Param('labelId', ParseIntPipe) labelId: number,
  ): Promise<LabelResponseDto[]> {
    const labels = await this.taskLabelsService.add(id, labelId);
    return labels.map((label) => LabelResponseDto.fromEntity(label));
  }

  @Delete(':id/labels/:labelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeLabel(
    @Param('id', ParseIntPipe) id: number,
    @Param('labelId', ParseIntPipe) labelId: number,
  ): Promise<void> {
    await this.taskLabelsService.remove(id, labelId);
  }
}
