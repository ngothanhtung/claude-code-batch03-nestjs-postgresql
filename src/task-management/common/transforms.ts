/** class-transformer helper: trims string input, leaves other values untouched. */
export const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** class-transformer helper: trims and lower-cases string input. */
export const trimLower = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
