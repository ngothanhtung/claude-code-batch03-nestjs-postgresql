import { PaginationQueryDto } from './pagination-query.dto';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Builds the `{ data, meta }` envelope shared by every list endpoint. */
export function toPaginated<E, D>(
  items: E[],
  total: number,
  query: PaginationQueryDto,
  map: (item: E) => D,
): PaginatedResponse<D> {
  return {
    data: items.map(map),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}
