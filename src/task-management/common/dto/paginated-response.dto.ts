import { PaginationQueryDto } from './pagination-query.dto';

/** Pagination details returned alongside every list endpoint. */
export class PaginationMeta {
  /** Current page (1-based). */
  page: number;
  /** Page size requested. */
  limit: number;
  /** Total number of matching items. */
  total: number;
  /** Total number of pages for the given limit. */
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
