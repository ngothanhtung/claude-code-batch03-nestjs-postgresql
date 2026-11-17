import { applyDecorators } from '@nestjs/common';
import { IsISO8601, Matches } from 'class-validator';

/** Validates a calendar date in strict `YYYY-MM-DD` form (e.g. rejects 2025-02-30). */
export function IsDateOnly(): PropertyDecorator {
  return applyDecorators(
    Matches(/^\d{4}-\d{2}-\d{2}$/, {
      message: ({ property }) => `${property} must be in YYYY-MM-DD format`,
    }),
    IsISO8601({ strict: true }),
  );
}
