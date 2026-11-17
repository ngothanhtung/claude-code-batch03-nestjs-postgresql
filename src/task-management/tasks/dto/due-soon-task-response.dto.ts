import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import { Task } from '../entities/task.entity';
import { TaskResponseDto } from './task-response.dto';

export class DueSoonTaskResponseDto extends TaskResponseDto {
  /**
   * Số ngày còn lại tới hạn chót (`dueDate - hôm nay`); `0` = hết hạn hôm nay.
   * @example 3
   */
  daysRemaining: number;

  static fromTask(task: Task, daysRemaining: number): DueSoonTaskResponseDto {
    return Object.assign(
      new DueSoonTaskResponseDto(),
      TaskResponseDto.fromEntity(task),
      { daysRemaining },
    );
  }
}

export type PaginatedDueSoonTasksResponseDto =
  PaginatedResponse<DueSoonTaskResponseDto>;
