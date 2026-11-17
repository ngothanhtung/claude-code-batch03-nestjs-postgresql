import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto';

type ErrorStatus = 400 | 404 | 409;

/**
 * Documents the error responses of a handler, all sharing the NestJS
 * `{ statusCode, message, error }` body:
 *
 *   @ApiErrorResponses({ 404: 'Không tìm thấy người dùng.' })
 */
export function ApiErrorResponses(
  errors: Partial<Record<ErrorStatus, string>>,
) {
  return applyDecorators(
    ...Object.entries(errors).map(([status, description]) =>
      ApiResponse({
        status: Number(status),
        description,
        type: ErrorResponseDto,
      }),
    ),
  );
}
