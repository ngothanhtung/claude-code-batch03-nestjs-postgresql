import { ArrayMaxSize, IsArray, IsInt, IsPositive } from 'class-validator';

/** Replaces the full label set of a task (`[]` removes all labels). */
export class SetTaskLabelsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  labelIds: number[];
}
