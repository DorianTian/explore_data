export const SQL_DIALECTS = ['mysql', 'postgresql', 'hive', 'sparksql', 'flinksql'] as const;

export type SqlDialect = (typeof SQL_DIALECTS)[number];

/** Engine types for datasource classification */
export const ENGINE_TYPES = ['hive', 'iceberg', 'spark', 'mysql', 'doris'] as const;
export type EngineType = (typeof ENGINE_TYPES)[number];

/** Data warehouse layer classification */
export const WAREHOUSE_LAYERS = ['ods', 'dwd', 'dws', 'dim', 'ads'] as const;
export type WarehouseLayer = (typeof WAREHOUSE_LAYERS)[number];

/** Business domain tags */
export const BUSINESS_DOMAINS = ['trade', 'user', 'product', 'risk'] as const;
export type BusinessDomain = (typeof BUSINESS_DOMAINS)[number];
