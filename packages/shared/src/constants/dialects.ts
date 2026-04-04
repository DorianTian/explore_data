export const SQL_DIALECTS = ['mysql', 'postgresql', 'hive', 'sparksql', 'flinksql'] as const;

export type SqlDialect = (typeof SQL_DIALECTS)[number];
