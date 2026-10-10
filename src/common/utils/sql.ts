/**
 * Builds "col1 = ?, col2 = ?" from an object, skipping undefined values
 * (so PATCH requests only touch the fields that were sent; null clears a column).
 * Column names come from code, never from user input.
 */
export function buildSetClause(fields: Record<string, unknown>): {
  sql: string;
  values: unknown[];
} {
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  return {
    sql: entries.map(([column]) => `\`${column}\` = ?`).join(', '),
    values: entries.map(([, value]) => value),
  };
}

/** "(?, ?, ?)" placeholders for an IN (...) clause. */
export function inPlaceholders(count: number): string {
  return `(${new Array(count).fill('?').join(', ')})`;
}
