import { ApiProperty } from '@nestjs/swagger';

/** Định dạng body lỗi mặc định của NestJS (`HttpException`). */
export class ErrorResponseDto {
  @ApiProperty({ description: 'Mã trạng thái HTTP.', example: 404 })
  statusCode: number;

  @ApiProperty({
    description:
      'Thông điệp lỗi. Với lỗi validate dữ liệu đầu vào, đây là **mảng** ' +
      'các thông điệp (mỗi phần tử ứng với một ràng buộc bị vi phạm).',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'User #42 not found',
  })
  message: string | string[];

  @ApiProperty({
    description: 'Tên ngắn của mã trạng thái HTTP.',
    example: 'Not Found',
  })
  error: string;
}
