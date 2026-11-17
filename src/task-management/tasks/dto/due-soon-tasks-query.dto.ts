import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export const DUE_SOON_DEFAULT_DAYS = 7;
export const DUE_SOON_MAX_DAYS = 365;

export class DueSoonTasksQueryDto extends PaginationQueryDto {
  /**
   * Số ngày tính từ hôm nay: lấy các task có hạn chót trong khoảng
   * `[hôm nay, hôm nay + days]` (bao gồm hai đầu). `0` = chỉ task hết hạn hôm nay.
   * @example 7
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(DUE_SOON_MAX_DAYS)
  days: number = DUE_SOON_DEFAULT_DAYS;
}
