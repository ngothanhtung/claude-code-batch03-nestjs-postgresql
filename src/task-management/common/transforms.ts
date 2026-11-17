/** class-transformer helper: trims string input, leaves other values untouched. */
export const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** class-transformer helper: trims and lower-cases string input. */
export const trimLower = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/**
 * class-transformer helper for boolean query params: maps the strings
 * `'true'` / `'false'` to booleans and leaves anything else for `@IsBoolean()`
 * to reject (`@Type(() => Boolean)` would turn `'false'` into `true`).
 */
export const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};
