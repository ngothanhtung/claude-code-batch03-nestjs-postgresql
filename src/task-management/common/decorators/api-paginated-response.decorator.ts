import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { PaginationMeta } from '../dto/paginated-response.dto';

/**
 * Documents the `{ data: T[], meta }` envelope produced by `toPaginated()`.
 * The generic `PaginatedResponse<T>` is erased at runtime, so the schema is
 * composed explicitly here.
 */
export function ApiPaginatedResponse<T extends Type<unknown>>(model: T) {
  return applyDecorators(
    ApiExtraModels(PaginationMeta, model),
    ApiOkResponse({
      schema: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
          meta: { $ref: getSchemaPath(PaginationMeta) },
        },
      },
    }),
  );
}
