export function resolveTableName(tableName: string, prefix?: string): string {
  return prefix === undefined ? tableName : `${prefix}_${tableName}`;
}
