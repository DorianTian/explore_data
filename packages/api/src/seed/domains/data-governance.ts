import type { DomainDefinition, TableDef } from './types.js';
import { col, generateSummaryTable } from '../generator.js';

/* ------------------------------------------------------------------ */
/*  ODS Layer — Raw operational tables (~20)                          */
/* ------------------------------------------------------------------ */

const odsTables: TableDef[] = [
  /* ---------- Metadata Catalog ---------- */
  {
    name: 'ods_meta_database',
    comment: '元数据-数据库注册信息',
    layer: 'ods',
    columns: [
      col.id('数据库ID'),
      col.varchar('database_name', 200, '数据库名称', { isNullable: false }),
      col.varchar('database_type', 50, '数据库类型: mysql/postgresql/hive/clickhouse'),
      col.varchar('host', 255, '连接地址'),
      col.int('port', '连接端口'),
      col.varchar('env', 30, '环境: prod/staging/dev'),
      col.varchar('owner', 100, '负责人'),
      col.text('description', '数据库描述'),
      col.json('connection_config', '连接配置(脱敏)'),
      col.bool('is_active', '是否启用', 'true'),
      col.createdAt(),
      col.updatedAt(),
    ],
  },
  {
    name: 'ods_meta_schema',
    comment: '元数据-Schema信息',
    layer: 'ods',
    columns: [
      col.id('SchemaID'),
      col.fk('database_id', 'ods_meta_database', '所属数据库ID'),
      col.varchar('schema_name', 200, 'Schema名称', { isNullable: false }),
      col.varchar('owner', 100, '负责人'),
      col.text('description', 'Schema描述'),
      col.int('table_count', '表数量'),
      col.createdAt(),
      col.updatedAt(),
    ],
  },
  {
    name: 'ods_meta_table',
    comment: '元数据-表注册信息',
    layer: 'ods',
    columns: [
      col.id('表ID'),
      col.fk('schema_id', 'ods_meta_schema', '所属SchemaID'),
      col.varchar('table_name', 300, '表名', { isNullable: false }),
      col.varchar('table_type', 30, '表类型: table/view/materialized_view'),
      col.varchar('storage_format', 50, '存储格式: parquet/orc/csv/json'),
      col.bigint('row_count', '行数(最近一次统计)'),
      col.bigint('size_bytes', '存储大小(字节)'),
      col.varchar('owner', 100, '负责人'),
      col.varchar('lifecycle_status', 30, '生命周期状态: active/deprecated/archived'),
      col.text('description', '表描述'),
      col.json('partitions', '分区信息'),
      col.timestamp('last_ddl_time', '最后DDL变更时间'),
      col.createdAt(),
      col.updatedAt(),
    ],
  },
  {
    name: 'ods_meta_column',
    comment: '元数据-字段注册信息',
    layer: 'ods',
    columns: [
      col.id('字段ID'),
      col.fk('table_id', 'ods_meta_table', '所属表ID'),
      col.varchar('column_name', 300, '字段名', { isNullable: false }),
      col.varchar('data_type', 100, '数据类型'),
      col.int('ordinal_position', '字段顺序'),
      col.bool('is_nullable', '是否可空', 'true'),
      col.bool('is_primary_key', '是否主键', 'false'),
      col.bool('is_partition_key', '是否分区键', 'false'),
      col.varchar('default_value', 500, '默认值'),
      col.text('description', '字段描述'),
      col.varchar('classification_level', 30, '分类级别: public/internal/confidential/restricted'),
      col.createdAt(),
      col.updatedAt(),
    ],
  },

  /* ---------- Data Quality ---------- */
  {
    name: 'ods_dq_rule',
    comment: '数据质量-规则定义',
    layer: 'ods',
    columns: [
      col.id('规则ID'),
      col.varchar('rule_name', 200, '规则名称', { isNullable: false }),
      col.varchar('rule_type', 50, '规则类型: completeness/accuracy/consistency/timeliness/uniqueness/validity'),
      col.varchar('severity', 20, '严重级别: critical/major/minor/info'),
      col.fk('table_id', 'ods_meta_table', '关联表ID'),
      col.varchar('column_name', 300, '关联字段名(可空)'),
      col.text('check_expression', '校验表达式/SQL'),
      col.text('description', '规则描述'),
      col.decimal('threshold', '5,2', '阈值百分比'),
      col.bool('is_enabled', '是否启用', 'true'),
      col.varchar('schedule_cron', 100, '调度Cron表达式'),
      col.varchar('owner', 100, '规则负责人'),
      col.createdAt(),
      col.updatedAt(),
    ],
  },
  {
    name: 'ods_dq_check_result',
    comment: '数据质量-检查结果',
    layer: 'ods',
    columns: [
      col.id('检查结果ID'),
      col.fk('rule_id', 'ods_dq_rule', '规则ID'),
      col.fk('table_id', 'ods_meta_table', '关联表ID'),
      col.timestamp('check_time', '检查时间'),
      col.varchar('result_status', 30, '检查结果: passed/failed/warning/error'),
      col.bigint('total_rows', '总行数'),
      col.bigint('failed_rows', '不合格行数'),
      col.decimal('pass_rate', '7,4', '通过率'),
      col.text('error_sample', '错误样本(JSON)'),
      col.int('execution_time_ms', '执行耗时(毫秒)'),
      col.ds(),
      col.createdAt(),
    ],
  },

  /* ---------- Data Lineage ---------- */
  {
    name: 'ods_lineage_table',
    comment: '数据血缘-表级血缘',
    layer: 'ods',
    columns: [
      col.id('血缘ID'),
      col.fk('source_table_id', 'ods_meta_table', '源表ID'),
      col.fk('target_table_id', 'ods_meta_table', '目标表ID'),
      col.varchar('lineage_type', 30, '血缘类型: etl/view/manual'),
      col.varchar('job_name', 200, '关联作业名'),
      col.varchar('transform_type', 50, '转换类型: full/incremental/snapshot'),
      col.text('transform_logic', '转换逻辑描述'),
      col.bool('is_active', '是否有效', 'true'),
      col.timestamp('last_run_time', '最后运行时间'),
      col.createdAt(),
      col.updatedAt(),
    ],
  },
  {
    name: 'ods_lineage_column',
    comment: '数据血缘-字段级血缘',
    layer: 'ods',
    columns: [
      col.id('字段血缘ID'),
      col.fk('lineage_id', 'ods_lineage_table', '表级血缘ID'),
      col.fk('source_column_id', 'ods_meta_column', '源字段ID'),
      col.fk('target_column_id', 'ods_meta_column', '目标字段ID'),
      col.varchar('transform_expression', 500, '转换表达式'),
      col.createdAt(),
    ],
  },
  {
    name: 'ods_lineage_job',
    comment: '数据血缘-作业信息',
    layer: 'ods',
    columns: [
      col.id('作业ID'),
      col.varchar('job_name', 200, '作业名称', { isNullable: false }),
      col.varchar('job_type', 50, '作业类型: spark/flink/hive_sql/python/dbt'),
      col.varchar('schedule_type', 30, '调度方式: cron/event/manual'),
      col.varchar('schedule_cron', 100, '调度表达式'),
      col.varchar('owner', 100, '作业负责人'),
      col.varchar('status', 30, '状态: running/success/failed/paused'),
      col.timestamp('last_success_time', '最后成功时间'),
      col.int('avg_duration_sec', '平均运行时长(秒)'),
      col.createdAt(),
      col.updatedAt(),
    ],
  },

  /* ---------- Access Control & Permissions ---------- */
  {
    name: 'ods_acl_permission',
    comment: '权限管理-授权记录',
    layer: 'ods',
    columns: [
      col.id('授权ID'),
      col.varchar('principal_type', 30, '主体类型: user/group/role'),
      col.varchar('principal_name', 200, '主体名称'),
      col.varchar('resource_type', 30, '资源类型: database/schema/table/column'),
      col.bigint('resource_id', '资源ID'),
      col.varchar('permission', 30, '权限: select/insert/update/delete/admin'),
      col.varchar('granted_by', 100, '授权人'),
      col.timestamp('grant_time', '授权时间'),
      col.timestamp('expire_time', '过期时间'),
      col.bool('is_active', '是否生效', 'true'),
      col.createdAt(),
    ],
  },
  {
    name: 'ods_acl_role',
    comment: '权限管理-角色定义',
    layer: 'ods',
    columns: [
      col.id('角色ID'),
      col.varchar('role_name', 100, '角色名称', { isNullable: false }),
      col.text('description', '角色描述'),
      col.json('default_permissions', '默认权限集合'),
      col.bool('is_system_role', '是否系统内置角色', 'false'),
      col.createdAt(),
      col.updatedAt(),
    ],
  },

  /* ---------- Data Classification ---------- */
  {
    name: 'ods_classification_rule',
    comment: '数据分类-分类规则',
    layer: 'ods',
    columns: [
      col.id('规则ID'),
      col.varchar('rule_name', 200, '规则名称', { isNullable: false }),
      col.varchar('sensitivity_level', 30, '敏感级别: public/internal/confidential/restricted'),
      col.varchar('category', 50, '分类类别: pii/financial/health/credential/business'),
      col.text('match_pattern', '匹配模式(正则/关键词)'),
      col.varchar('match_type', 30, '匹配方式: regex/keyword/ml_model'),
      col.bool('is_enabled', '是否启用', 'true'),
      col.int('priority', '优先级'),
      col.createdAt(),
      col.updatedAt(),
    ],
  },
  {
    name: 'ods_classification_result',
    comment: '数据分类-分类结果',
    layer: 'ods',
    columns: [
      col.id('分类结果ID'),
      col.fk('column_id', 'ods_meta_column', '字段ID'),
      col.fk('rule_id', 'ods_classification_rule', '命中规则ID'),
      col.varchar('sensitivity_level', 30, '敏感级别'),
      col.varchar('category', 50, '分类类别'),
      col.decimal('confidence', '5,4', '置信度'),
      col.varchar('scan_method', 30, '扫描方式: auto/manual'),
      col.timestamp('scan_time', '扫描时间'),
      col.bool('is_confirmed', '是否人工确认', 'false'),
      col.createdAt(),
    ],
  },

  /* ---------- Audit Trail ---------- */
  {
    name: 'ods_audit_log',
    comment: '审计日志-操作记录',
    layer: 'ods',
    columns: [
      col.id('日志ID'),
      col.varchar('action_type', 50, '操作类型: query/ddl/dml/grant/revoke/export/login'),
      col.varchar('operator', 200, '操作人'),
      col.varchar('resource_type', 30, '资源类型'),
      col.bigint('resource_id', '资源ID'),
      col.varchar('resource_name', 300, '资源名称'),
      col.text('action_detail', '操作详情(SQL/参数)'),
      col.varchar('ip_address', 50, 'IP地址'),
      col.varchar('client_tool', 100, '客户端工具'),
      col.varchar('result_status', 20, '执行结果: success/denied/error'),
      col.int('affected_rows', '影响行数'),
      col.timestamp('action_time', '操作时间'),
      col.createdAt(),
    ],
  },

  /* ---------- Data Lifecycle ---------- */
  {
    name: 'ods_lifecycle_policy',
    comment: '数据生命周期-策略定义',
    layer: 'ods',
    columns: [
      col.id('策略ID'),
      col.varchar('policy_name', 200, '策略名称', { isNullable: false }),
      col.varchar('target_type', 30, '目标类型: table/partition/database'),
      col.int('hot_days', '热数据保留天数'),
      col.int('warm_days', '温数据保留天数'),
      col.int('cold_days', '冷数据保留天数'),
      col.int('archive_days', '归档天数'),
      col.int('delete_days', '删除天数'),
      col.bool('is_enabled', '是否启用', 'true'),
      col.text('description', '策略描述'),
      col.createdAt(),
      col.updatedAt(),
    ],
  },
  {
    name: 'ods_lifecycle_binding',
    comment: '数据生命周期-策略绑定',
    layer: 'ods',
    columns: [
      col.id('绑定ID'),
      col.fk('policy_id', 'ods_lifecycle_policy', '策略ID'),
      col.fk('table_id', 'ods_meta_table', '目标表ID'),
      col.varchar('current_stage', 30, '当前阶段: hot/warm/cold/archived'),
      col.timestamp('stage_changed_at', '阶段变更时间'),
      col.timestamp('next_action_at', '下次操作时间'),
      col.createdAt(),
    ],
  },

  /* ---------- Compliance ---------- */
  {
    name: 'ods_compliance_rule',
    comment: '合规管理-合规规则',
    layer: 'ods',
    columns: [
      col.id('合规规则ID'),
      col.varchar('rule_name', 200, '规则名称', { isNullable: false }),
      col.varchar('regulation', 100, '法规标准: GDPR/CCPA/SOX/PIPL/HIPAA'),
      col.varchar('category', 50, '规则类别: retention/access/encryption/masking/consent'),
      col.text('requirement', '合规要求描述'),
      col.text('check_logic', '检查逻辑SQL'),
      col.varchar('severity', 20, '严重级别: critical/major/minor'),
      col.bool('is_enabled', '是否启用', 'true'),
      col.createdAt(),
      col.updatedAt(),
    ],
  },

  /* ---------- Data Profiling ---------- */
  {
    name: 'ods_profiling_result',
    comment: '数据画像-Profiling结果',
    layer: 'ods',
    columns: [
      col.id('画像结果ID'),
      col.fk('column_id', 'ods_meta_column', '字段ID'),
      col.bigint('total_count', '总记录数'),
      col.bigint('null_count', '空值数'),
      col.bigint('distinct_count', '去重数'),
      col.decimal('null_rate', '7,4', '空值率'),
      col.decimal('distinct_rate', '7,4', '去重率'),
      col.varchar('min_value', 500, '最小值'),
      col.varchar('max_value', 500, '最大值'),
      col.varchar('avg_value', 500, '平均值'),
      col.decimal('stddev', '18,6', '标准差'),
      col.json('top_values', 'Top N值分布(JSON)'),
      col.json('histogram', '直方图数据(JSON)'),
      col.timestamp('profiled_at', 'Profiling执行时间'),
      col.ds(),
      col.createdAt(),
    ],
  },

  /* ---------- Schema Change History ---------- */
  {
    name: 'ods_schema_change',
    comment: 'Schema变更历史',
    layer: 'ods',
    columns: [
      col.id('变更ID'),
      col.fk('table_id', 'ods_meta_table', '关联表ID'),
      col.varchar('change_type', 30, '变更类型: add_column/drop_column/modify_column/rename/add_index/drop_index'),
      col.text('ddl_statement', 'DDL语句'),
      col.json('before_snapshot', '变更前快照'),
      col.json('after_snapshot', '变更后快照'),
      col.varchar('changed_by', 100, '变更人'),
      col.text('change_reason', '变更原因'),
      col.varchar('ticket_id', 100, '关联工单号'),
      col.timestamp('changed_at', '变更时间'),
      col.createdAt(),
    ],
  },

  /* ---------- Tag & Ownership ---------- */
  {
    name: 'ods_tag',
    comment: '标签管理-标签定义',
    layer: 'ods',
    columns: [
      col.id('标签ID'),
      col.varchar('tag_key', 100, '标签键', { isNullable: false }),
      col.varchar('tag_value', 200, '标签值'),
      col.varchar('tag_category', 50, '标签分类: business/technical/security/compliance'),
      col.text('description', '标签描述'),
      col.createdAt(),
      col.updatedAt(),
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  DWD Layer — Cleaned & joined tables (~20)                         */
/* ------------------------------------------------------------------ */

const dwdTables: TableDef[] = [
  {
    name: 'dwd_meta_table_detail',
    comment: '表元数据明细(关联库/Schema/Owner)',
    layer: 'dwd',
    columns: [
      col.id('明细ID'),
      col.fk('table_id', 'ods_meta_table', '表ID'),
      col.varchar('database_name', 200, '数据库名称'),
      col.varchar('schema_name', 200, 'Schema名称'),
      col.varchar('table_name', 300, '表名'),
      col.varchar('table_type', 30, '表类型'),
      col.varchar('storage_format', 50, '存储格式'),
      col.bigint('row_count', '行数'),
      col.bigint('size_bytes', '存储大小'),
      col.varchar('owner', 100, '负责人'),
      col.varchar('lifecycle_status', 30, '生命周期状态'),
      col.int('column_count', '字段总数'),
      col.int('pii_column_count', 'PII字段数'),
      col.varchar('env', 30, '环境'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'dwd_meta_column_detail',
    comment: '字段元数据明细(关联表/分类)',
    layer: 'dwd',
    columns: [
      col.id('明细ID'),
      col.fk('column_id', 'ods_meta_column', '字段ID'),
      col.varchar('database_name', 200, '数据库名称'),
      col.varchar('schema_name', 200, 'Schema名称'),
      col.varchar('table_name', 300, '表名'),
      col.varchar('column_name', 300, '字段名'),
      col.varchar('data_type', 100, '数据类型'),
      col.int('ordinal_position', '字段顺序'),
      col.bool('is_primary_key', '是否主键', 'false'),
      col.varchar('sensitivity_level', 30, '敏感级别'),
      col.varchar('classification_category', 50, '分类类别'),
      col.bool('has_profiling', '是否已Profiling', 'false'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'dwd_dq_check_detail',
    comment: '数据质量检查明细(关联规则/表)',
    layer: 'dwd',
    columns: [
      col.id('明细ID'),
      col.fk('result_id', 'ods_dq_check_result', '检查结果ID'),
      col.fk('rule_id', 'ods_dq_rule', '规则ID'),
      col.varchar('rule_name', 200, '规则名称'),
      col.varchar('rule_type', 50, '规则类型'),
      col.varchar('severity', 20, '严重级别'),
      col.varchar('table_name', 300, '表名'),
      col.varchar('column_name', 300, '字段名'),
      col.varchar('result_status', 30, '检查结果'),
      col.bigint('total_rows', '总行数'),
      col.bigint('failed_rows', '不合格行数'),
      col.decimal('pass_rate', '7,4', '通过率'),
      col.int('execution_time_ms', '执行耗时(毫秒)'),
      col.timestamp('check_time', '检查时间'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'dwd_lineage_full',
    comment: '全链路血缘明细(表+字段+作业)',
    layer: 'dwd',
    columns: [
      col.id('明细ID'),
      col.fk('lineage_id', 'ods_lineage_table', '表级血缘ID'),
      col.varchar('source_database', 200, '源数据库'),
      col.varchar('source_table', 300, '源表'),
      col.varchar('target_database', 200, '目标数据库'),
      col.varchar('target_table', 300, '目标表'),
      col.varchar('job_name', 200, '作业名称'),
      col.varchar('job_type', 50, '作业类型'),
      col.varchar('lineage_type', 30, '血缘类型'),
      col.varchar('transform_type', 50, '转换类型'),
      col.int('column_lineage_count', '字段血缘数'),
      col.bool('is_active', '是否有效', 'true'),
      col.timestamp('last_run_time', '最后运行时间'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'dwd_lineage_column_detail',
    comment: '字段级血缘明细(含源/目标表名)',
    layer: 'dwd',
    columns: [
      col.id('明细ID'),
      col.fk('column_lineage_id', 'ods_lineage_column', '字段血缘ID'),
      col.varchar('source_table', 300, '源表'),
      col.varchar('source_column', 300, '源字段'),
      col.varchar('target_table', 300, '目标表'),
      col.varchar('target_column', 300, '目标字段'),
      col.varchar('transform_expression', 500, '转换表达式'),
      col.varchar('job_name', 200, '关联作业'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'dwd_acl_permission_detail',
    comment: '权限授权明细(关联角色/资源)',
    layer: 'dwd',
    columns: [
      col.id('明细ID'),
      col.fk('permission_id', 'ods_acl_permission', '授权ID'),
      col.varchar('principal_type', 30, '主体类型'),
      col.varchar('principal_name', 200, '主体名称'),
      col.varchar('role_name', 100, '角色名称'),
      col.varchar('resource_type', 30, '资源类型'),
      col.varchar('resource_name', 300, '资源名称'),
      col.varchar('permission', 30, '权限'),
      col.varchar('granted_by', 100, '授权人'),
      col.bool('is_active', '是否生效', 'true'),
      col.bool('is_expired', '是否已过期', 'false'),
      col.timestamp('grant_time', '授权时间'),
      col.timestamp('expire_time', '过期时间'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'dwd_classification_detail',
    comment: '数据分类明细(关联字段/表)',
    layer: 'dwd',
    columns: [
      col.id('明细ID'),
      col.fk('result_id', 'ods_classification_result', '分类结果ID'),
      col.varchar('database_name', 200, '数据库名称'),
      col.varchar('table_name', 300, '表名'),
      col.varchar('column_name', 300, '字段名'),
      col.varchar('sensitivity_level', 30, '敏感级别'),
      col.varchar('category', 50, '分类类别'),
      col.decimal('confidence', '5,4', '置信度'),
      col.varchar('scan_method', 30, '扫描方式'),
      col.bool('is_confirmed', '是否确认', 'false'),
      col.timestamp('scan_time', '扫描时间'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'dwd_audit_log_detail',
    comment: '审计日志明细(富化操作人/资源信息)',
    layer: 'dwd',
    columns: [
      col.id('明细ID'),
      col.fk('log_id', 'ods_audit_log', '日志ID'),
      col.varchar('action_type', 50, '操作类型'),
      col.varchar('operator', 200, '操作人'),
      col.varchar('operator_dept', 200, '操作人部门'),
      col.varchar('resource_type', 30, '资源类型'),
      col.varchar('resource_name', 300, '资源名称'),
      col.varchar('database_name', 200, '数据库名称'),
      col.varchar('result_status', 20, '执行结果'),
      col.int('affected_rows', '影响行数'),
      col.varchar('ip_address', 50, 'IP地址'),
      col.varchar('client_tool', 100, '客户端工具'),
      col.timestamp('action_time', '操作时间'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'dwd_lifecycle_detail',
    comment: '生命周期管理明细(策略+表)',
    layer: 'dwd',
    columns: [
      col.id('明细ID'),
      col.fk('binding_id', 'ods_lifecycle_binding', '绑定ID'),
      col.varchar('policy_name', 200, '策略名称'),
      col.varchar('table_name', 300, '表名'),
      col.varchar('current_stage', 30, '当前阶段'),
      col.int('hot_days', '热数据保留天数'),
      col.int('warm_days', '温数据保留天数'),
      col.int('cold_days', '冷数据保留天数'),
      col.timestamp('stage_changed_at', '阶段变更时间'),
      col.timestamp('next_action_at', '下次操作时间'),
      col.bigint('size_bytes', '当前存储大小'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'dwd_compliance_check_detail',
    comment: '合规检查明细(关联规则/资源)',
    layer: 'dwd',
    columns: [
      col.id('明细ID'),
      col.fk('rule_id', 'ods_compliance_rule', '合规规则ID'),
      col.varchar('rule_name', 200, '规则名称'),
      col.varchar('regulation', 100, '法规标准'),
      col.varchar('category', 50, '规则类别'),
      col.varchar('resource_type', 30, '资源类型'),
      col.varchar('resource_name', 300, '资源名称'),
      col.varchar('check_result', 20, '检查结果: compliant/non_compliant/na'),
      col.text('violation_detail', '违规详情'),
      col.varchar('severity', 20, '严重级别'),
      col.timestamp('check_time', '检查时间'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'dwd_profiling_detail',
    comment: 'Profiling明细(关联表/字段元数据)',
    layer: 'dwd',
    columns: [
      col.id('明细ID'),
      col.fk('profiling_id', 'ods_profiling_result', '画像结果ID'),
      col.varchar('database_name', 200, '数据库名称'),
      col.varchar('table_name', 300, '表名'),
      col.varchar('column_name', 300, '字段名'),
      col.varchar('data_type', 100, '数据类型'),
      col.bigint('total_count', '总记录数'),
      col.decimal('null_rate', '7,4', '空值率'),
      col.decimal('distinct_rate', '7,4', '去重率'),
      col.varchar('min_value', 500, '最小值'),
      col.varchar('max_value', 500, '最大值'),
      col.timestamp('profiled_at', 'Profiling时间'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'dwd_schema_change_detail',
    comment: 'Schema变更明细(关联表/库)',
    layer: 'dwd',
    columns: [
      col.id('明细ID'),
      col.fk('change_id', 'ods_schema_change', '变更ID'),
      col.varchar('database_name', 200, '数据库名称'),
      col.varchar('table_name', 300, '表名'),
      col.varchar('change_type', 30, '变更类型'),
      col.text('ddl_statement', 'DDL语句'),
      col.varchar('changed_by', 100, '变更人'),
      col.varchar('ticket_id', 100, '关联工单号'),
      col.timestamp('changed_at', '变更时间'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'dwd_tag_binding',
    comment: '标签绑定明细(标签+资源)',
    layer: 'dwd',
    columns: [
      col.id('明细ID'),
      col.fk('tag_id', 'ods_tag', '标签ID'),
      col.varchar('tag_key', 100, '标签键'),
      col.varchar('tag_value', 200, '标签值'),
      col.varchar('tag_category', 50, '标签分类'),
      col.varchar('resource_type', 30, '资源类型: database/schema/table/column'),
      col.bigint('resource_id', '资源ID'),
      col.varchar('resource_name', 300, '资源名称'),
      col.varchar('bound_by', 100, '绑定人'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'dwd_ownership_detail',
    comment: '资产归属明细(Owner/团队/层级)',
    layer: 'dwd',
    columns: [
      col.id('明细ID'),
      col.varchar('resource_type', 30, '资源类型'),
      col.bigint('resource_id', '资源ID'),
      col.varchar('resource_name', 300, '资源名称'),
      col.varchar('owner', 100, '负责人'),
      col.varchar('owner_team', 100, '所属团队'),
      col.varchar('owner_dept', 200, '所属部门'),
      col.varchar('backup_owner', 100, '备份负责人'),
      col.timestamp('assigned_at', '分配时间'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'dwd_sla_config',
    comment: 'SLA配置明细(表级新鲜度SLA)',
    layer: 'dwd',
    columns: [
      col.id('配置ID'),
      col.fk('table_id', 'ods_meta_table', '表ID'),
      col.varchar('table_name', 300, '表名'),
      col.varchar('sla_level', 20, 'SLA级别: P0/P1/P2/P3'),
      col.int('expected_ready_hour', '期望就绪时间(小时)'),
      col.int('expected_ready_minute', '期望就绪时间(分钟)'),
      col.int('max_delay_minutes', '最大允许延迟(分钟)'),
      col.varchar('alert_channel', 50, '告警通道: dingtalk/email/sms/pagerduty'),
      col.varchar('owner', 100, '负责人'),
      col.bool('is_enabled', '是否启用', 'true'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'dwd_data_dictionary',
    comment: '数据字典明细(标准化术语/枚举映射)',
    layer: 'dwd',
    columns: [
      col.id('字典ID'),
      col.varchar('dict_code', 100, '字典编码', { isNullable: false }),
      col.varchar('dict_name', 200, '字典名称'),
      col.varchar('category', 50, '字典类别'),
      col.varchar('item_key', 100, '条目键'),
      col.varchar('item_value', 500, '条目值'),
      col.int('sort_order', '排序序号'),
      col.bool('is_standard', '是否标准化', 'true'),
      col.text('description', '条目描述'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'dwd_sla_check_result',
    comment: 'SLA检查结果(每日新鲜度检测)',
    layer: 'dwd',
    columns: [
      col.id('检查ID'),
      col.fk('sla_config_id', 'dwd_sla_config', 'SLA配置ID'),
      col.varchar('table_name', 300, '表名'),
      col.varchar('sla_level', 20, 'SLA级别'),
      col.timestamp('expected_ready_time', '期望就绪时间'),
      col.timestamp('actual_ready_time', '实际就绪时间'),
      col.int('delay_minutes', '延迟分钟数'),
      col.varchar('check_result', 20, '检查结果: met/breached/pending'),
      col.bool('alert_sent', '是否已告警', 'false'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'dwd_job_execution',
    comment: '作业执行记录明细',
    layer: 'dwd',
    columns: [
      col.id('执行ID'),
      col.fk('job_id', 'ods_lineage_job', '作业ID'),
      col.varchar('job_name', 200, '作业名称'),
      col.varchar('job_type', 50, '作业类型'),
      col.varchar('execution_status', 30, '执行状态: running/success/failed/killed'),
      col.timestamp('start_time', '开始时间'),
      col.timestamp('end_time', '结束时间'),
      col.int('duration_sec', '执行时长(秒)'),
      col.bigint('input_rows', '输入行数'),
      col.bigint('output_rows', '输出行数'),
      col.text('error_message', '错误信息'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'dwd_compliance_violation',
    comment: '合规违规记录明细',
    layer: 'dwd',
    columns: [
      col.id('违规ID'),
      col.fk('rule_id', 'ods_compliance_rule', '合规规则ID'),
      col.varchar('regulation', 100, '法规标准'),
      col.varchar('resource_type', 30, '资源类型'),
      col.varchar('resource_name', 300, '资源名称'),
      col.varchar('violation_type', 50, '违规类型'),
      col.text('violation_detail', '违规详情'),
      col.varchar('severity', 20, '严重级别'),
      col.varchar('remediation_status', 30, '整改状态: open/in_progress/resolved/waived'),
      col.varchar('assignee', 100, '整改责任人'),
      col.timestamp('detected_at', '发现时间'),
      col.timestamp('resolved_at', '解决时间'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'dwd_profiling_anomaly',
    comment: 'Profiling异常明细(指标突变检测)',
    layer: 'dwd',
    columns: [
      col.id('异常ID'),
      col.fk('profiling_id', 'ods_profiling_result', '画像结果ID'),
      col.varchar('table_name', 300, '表名'),
      col.varchar('column_name', 300, '字段名'),
      col.varchar('anomaly_type', 50, '异常类型: null_spike/distinct_drop/value_drift/distribution_shift'),
      col.decimal('expected_value', '18,6', '期望值'),
      col.decimal('actual_value', '18,6', '实际值'),
      col.decimal('deviation', '10,4', '偏差程度'),
      col.varchar('severity', 20, '严重级别'),
      col.timestamp('detected_at', '检测时间'),
      col.ds(),
      col.etlTime(),
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  DWS Layer — Aggregated summary tables (~20)                       */
/* ------------------------------------------------------------------ */

const qualityDimensions = [
  { name: 'database_name', comment: '数据库名称' },
  { name: 'schema_name', comment: 'Schema名称' },
  { name: 'rule_type', comment: '规则类型' },
  { name: 'severity', comment: '严重级别' },
];

const qualityMetrics = [
  { name: 'total_checks', type: 'bigint', comment: '检查总数' },
  { name: 'passed_checks', type: 'bigint', comment: '通过数' },
  { name: 'failed_checks', type: 'bigint', comment: '失败数' },
  { name: 'avg_pass_rate', type: 'decimal', comment: '平均通过率' },
  { name: 'critical_failures', type: 'bigint', comment: '严重失败数' },
];

const dwsTables: TableDef[] = [
  generateSummaryTable(
    'dws_gov',
    'dq_daily_summary',
    '数据质量日汇总(按库/Schema/规则类型)',
    'dws',
    qualityDimensions,
    qualityMetrics,
  ),
  generateSummaryTable(
    'dws_gov',
    'dq_table_score',
    '表级数据质量评分',
    'dws',
    [
      { name: 'table_name', comment: '表名' },
      { name: 'database_name', comment: '数据库名称' },
      { name: 'owner', comment: '负责人' },
    ],
    [
      { name: 'completeness_score', type: 'decimal', comment: '完整性评分' },
      { name: 'accuracy_score', type: 'decimal', comment: '准确性评分' },
      { name: 'consistency_score', type: 'decimal', comment: '一致性评分' },
      { name: 'timeliness_score', type: 'decimal', comment: '时效性评分' },
      { name: 'overall_score', type: 'decimal', comment: '综合评分' },
      { name: 'rule_count', type: 'bigint', comment: '规则数' },
    ],
  ),
  generateSummaryTable(
    'dws_gov',
    'lineage_coverage',
    '血缘覆盖率汇总(按库)',
    'dws',
    [
      { name: 'database_name', comment: '数据库名称' },
      { name: 'schema_name', comment: 'Schema名称' },
    ],
    [
      { name: 'total_tables', type: 'bigint', comment: '表总数' },
      { name: 'tables_with_lineage', type: 'bigint', comment: '有血缘的表数' },
      { name: 'lineage_coverage_rate', type: 'decimal', comment: '血缘覆盖率' },
      { name: 'total_columns', type: 'bigint', comment: '字段总数' },
      { name: 'columns_with_lineage', type: 'bigint', comment: '有血缘的字段数' },
      { name: 'column_coverage_rate', type: 'decimal', comment: '字段血缘覆盖率' },
    ],
  ),
  generateSummaryTable(
    'dws_gov',
    'metadata_completeness',
    '元数据完整性汇总(按库)',
    'dws',
    [
      { name: 'database_name', comment: '数据库名称' },
      { name: 'schema_name', comment: 'Schema名称' },
    ],
    [
      { name: 'total_tables', type: 'bigint', comment: '表总数' },
      { name: 'tables_with_desc', type: 'bigint', comment: '有描述的表数' },
      { name: 'tables_with_owner', type: 'bigint', comment: '有负责人的表数' },
      { name: 'total_columns', type: 'bigint', comment: '字段总数' },
      { name: 'columns_with_desc', type: 'bigint', comment: '有描述的字段数' },
      { name: 'columns_with_type', type: 'bigint', comment: '有类型的字段数' },
      { name: 'completeness_rate', type: 'decimal', comment: '完整性百分比' },
    ],
  ),
  generateSummaryTable(
    'dws_gov',
    'classification_summary',
    '数据分类汇总(按敏感级别)',
    'dws',
    [
      { name: 'database_name', comment: '数据库名称' },
      { name: 'sensitivity_level', comment: '敏感级别' },
      { name: 'category', comment: '分类类别' },
    ],
    [
      { name: 'total_columns', type: 'bigint', comment: '字段数' },
      { name: 'confirmed_count', type: 'bigint', comment: '已确认数' },
      { name: 'unconfirmed_count', type: 'bigint', comment: '未确认数' },
      { name: 'avg_confidence', type: 'decimal', comment: '平均置信度' },
    ],
  ),
  generateSummaryTable(
    'dws_gov',
    'acl_summary',
    '权限分布汇总(按主体类型/资源类型)',
    'dws',
    [
      { name: 'principal_type', comment: '主体类型' },
      { name: 'resource_type', comment: '资源类型' },
      { name: 'permission', comment: '权限类型' },
    ],
    [
      { name: 'total_grants', type: 'bigint', comment: '授权总数' },
      { name: 'active_grants', type: 'bigint', comment: '有效授权数' },
      { name: 'expired_grants', type: 'bigint', comment: '过期授权数' },
      { name: 'distinct_principals', type: 'bigint', comment: '去重主体数' },
    ],
  ),
  generateSummaryTable(
    'dws_gov',
    'audit_daily_summary',
    '审计操作日汇总(按操作类型)',
    'dws',
    [
      { name: 'action_type', comment: '操作类型' },
      { name: 'operator_dept', comment: '操作人部门' },
      { name: 'result_status', comment: '执行结果' },
    ],
    [
      { name: 'operation_count', type: 'bigint', comment: '操作次数' },
      { name: 'distinct_operators', type: 'bigint', comment: '去重操作人数' },
      { name: 'total_affected_rows', type: 'bigint', comment: '总影响行数' },
      { name: 'denied_count', type: 'bigint', comment: '拒绝次数' },
    ],
  ),
  generateSummaryTable(
    'dws_gov',
    'lifecycle_summary',
    '生命周期管理汇总(按阶段)',
    'dws',
    [
      { name: 'current_stage', comment: '当前阶段' },
      { name: 'policy_name', comment: '策略名称' },
    ],
    [
      { name: 'table_count', type: 'bigint', comment: '表数量' },
      { name: 'total_size_bytes', type: 'bigint', comment: '总存储量(字节)' },
      { name: 'avg_age_days', type: 'decimal', comment: '平均数据年龄(天)' },
      { name: 'pending_action_count', type: 'bigint', comment: '待处理数' },
    ],
  ),
  generateSummaryTable(
    'dws_gov',
    'compliance_summary',
    '合规检查汇总(按法规/类别)',
    'dws',
    [
      { name: 'regulation', comment: '法规标准' },
      { name: 'category', comment: '规则类别' },
      { name: 'severity', comment: '严重级别' },
    ],
    [
      { name: 'total_checks', type: 'bigint', comment: '检查总数' },
      { name: 'compliant_count', type: 'bigint', comment: '合规数' },
      { name: 'non_compliant_count', type: 'bigint', comment: '不合规数' },
      { name: 'compliance_rate', type: 'decimal', comment: '合规率' },
      { name: 'open_violations', type: 'bigint', comment: '未解决违规数' },
    ],
  ),
  generateSummaryTable(
    'dws_gov',
    'profiling_summary',
    'Profiling覆盖率汇总(按库)',
    'dws',
    [
      { name: 'database_name', comment: '数据库名称' },
      { name: 'schema_name', comment: 'Schema名称' },
    ],
    [
      { name: 'total_columns', type: 'bigint', comment: '字段总数' },
      { name: 'profiled_columns', type: 'bigint', comment: '已Profiling字段数' },
      { name: 'profiling_coverage', type: 'decimal', comment: 'Profiling覆盖率' },
      { name: 'avg_null_rate', type: 'decimal', comment: '平均空值率' },
      { name: 'anomaly_count', type: 'bigint', comment: '异常数' },
    ],
  ),
  generateSummaryTable(
    'dws_gov',
    'sla_daily_summary',
    'SLA新鲜度日汇总(按级别)',
    'dws',
    [
      { name: 'sla_level', comment: 'SLA级别' },
      { name: 'database_name', comment: '数据库名称' },
    ],
    [
      { name: 'total_tables', type: 'bigint', comment: '监控表数' },
      { name: 'met_count', type: 'bigint', comment: '达标数' },
      { name: 'breached_count', type: 'bigint', comment: '违约数' },
      { name: 'pending_count', type: 'bigint', comment: '待检查数' },
      { name: 'sla_met_rate', type: 'decimal', comment: 'SLA达标率' },
      { name: 'avg_delay_minutes', type: 'decimal', comment: '平均延迟(分钟)' },
    ],
  ),
  generateSummaryTable(
    'dws_gov',
    'schema_change_summary',
    'Schema变更频率汇总(按库/变更类型)',
    'dws',
    [
      { name: 'database_name', comment: '数据库名称' },
      { name: 'change_type', comment: '变更类型' },
    ],
    [
      { name: 'change_count', type: 'bigint', comment: '变更次数' },
      { name: 'distinct_tables', type: 'bigint', comment: '涉及表数' },
      { name: 'distinct_operators', type: 'bigint', comment: '变更人数' },
    ],
  ),
  generateSummaryTable(
    'dws_gov',
    'tag_usage_summary',
    '标签使用汇总(按标签分类)',
    'dws',
    [
      { name: 'tag_category', comment: '标签分类' },
      { name: 'tag_key', comment: '标签键' },
    ],
    [
      { name: 'binding_count', type: 'bigint', comment: '绑定次数' },
      { name: 'distinct_resources', type: 'bigint', comment: '去重资源数' },
      { name: 'distinct_values', type: 'bigint', comment: '去重标签值数' },
    ],
  ),
  generateSummaryTable(
    'dws_gov',
    'ownership_summary',
    '资产归属分布汇总(按团队/部门)',
    'dws',
    [
      { name: 'owner_team', comment: '所属团队' },
      { name: 'owner_dept', comment: '所属部门' },
      { name: 'resource_type', comment: '资源类型' },
    ],
    [
      { name: 'total_resources', type: 'bigint', comment: '资源总数' },
      { name: 'has_owner_count', type: 'bigint', comment: '有负责人数' },
      { name: 'no_owner_count', type: 'bigint', comment: '无负责人数' },
    ],
  ),
  generateSummaryTable(
    'dws_gov',
    'job_execution_summary',
    '作业执行日汇总(按类型/状态)',
    'dws',
    [
      { name: 'job_type', comment: '作业类型' },
      { name: 'execution_status', comment: '执行状态' },
    ],
    [
      { name: 'execution_count', type: 'bigint', comment: '执行次数' },
      { name: 'success_count', type: 'bigint', comment: '成功次数' },
      { name: 'failed_count', type: 'bigint', comment: '失败次数' },
      { name: 'avg_duration_sec', type: 'decimal', comment: '平均时长(秒)' },
      { name: 'total_input_rows', type: 'bigint', comment: '总输入行数' },
      { name: 'total_output_rows', type: 'bigint', comment: '总输出行数' },
    ],
  ),
  generateSummaryTable(
    'dws_gov',
    'dq_trend_weekly',
    '数据质量周趋势(按规则类型)',
    'dws',
    [
      { name: 'rule_type', comment: '规则类型' },
      { name: 'week_start', comment: '周开始日期' },
    ],
    [
      { name: 'total_checks', type: 'bigint', comment: '检查总数' },
      { name: 'avg_pass_rate', type: 'decimal', comment: '平均通过率' },
      { name: 'pass_rate_change', type: 'decimal', comment: '通过率变化' },
      { name: 'new_failures', type: 'bigint', comment: '新增失败数' },
    ],
  ),
  generateSummaryTable(
    'dws_gov',
    'violation_aging',
    '违规工龄分布(未关闭违规按天数分布)',
    'dws',
    [
      { name: 'regulation', comment: '法规标准' },
      { name: 'severity', comment: '严重级别' },
      { name: 'aging_bucket', comment: '工龄区间: 0-7d/8-30d/31-90d/90d+' },
    ],
    [
      { name: 'violation_count', type: 'bigint', comment: '违规数' },
      { name: 'avg_open_days', type: 'decimal', comment: '平均开放天数' },
    ],
  ),
  generateSummaryTable(
    'dws_gov',
    'storage_distribution',
    '存储分布汇总(按生命周期阶段/格式)',
    'dws',
    [
      { name: 'lifecycle_stage', comment: '生命周期阶段' },
      { name: 'storage_format', comment: '存储格式' },
      { name: 'database_name', comment: '数据库名称' },
    ],
    [
      { name: 'table_count', type: 'bigint', comment: '表数量' },
      { name: 'total_size_bytes', type: 'bigint', comment: '总存储(字节)' },
      { name: 'total_rows', type: 'bigint', comment: '总行数' },
    ],
  ),
  generateSummaryTable(
    'dws_gov',
    'access_risk_summary',
    '访问风险汇总(高权限/异常访问)',
    'dws',
    [
      { name: 'risk_type', comment: '风险类型: over_privilege/unused_grant/cross_env/sensitive_access' },
      { name: 'principal_type', comment: '主体类型' },
    ],
    [
      { name: 'risk_count', type: 'bigint', comment: '风险数' },
      { name: 'affected_principals', type: 'bigint', comment: '影响主体数' },
      { name: 'affected_resources', type: 'bigint', comment: '影响资源数' },
    ],
  ),
  generateSummaryTable(
    'dws_gov',
    'dictionary_coverage',
    '数据字典覆盖率汇总',
    'dws',
    [
      { name: 'database_name', comment: '数据库名称' },
      { name: 'category', comment: '字典类别' },
    ],
    [
      { name: 'total_terms', type: 'bigint', comment: '术语总数' },
      { name: 'standardized_count', type: 'bigint', comment: '已标准化数' },
      { name: 'coverage_rate', type: 'decimal', comment: '覆盖率' },
    ],
  ),
];

/* ------------------------------------------------------------------ */
/*  ADS Layer — Application-facing tables (~20)                       */
/* ------------------------------------------------------------------ */

const adsTables: TableDef[] = [
  generateSummaryTable(
    'ads_gov',
    'overall_health',
    '治理健康度总览(全局仪表盘)',
    'ads',
    [
      { name: 'domain', comment: '治理领域' },
    ],
    [
      { name: 'score', type: 'decimal', comment: '评分(0-100)' },
      { name: 'trend', type: 'decimal', comment: '环比趋势' },
      { name: 'total_items', type: 'bigint', comment: '总项数' },
      { name: 'healthy_items', type: 'bigint', comment: '健康项数' },
      { name: 'warning_items', type: 'bigint', comment: '告警项数' },
      { name: 'critical_items', type: 'bigint', comment: '严重项数' },
    ],
  ),
  generateSummaryTable(
    'ads_gov',
    'dq_dashboard',
    '数据质量看板(Top问题表/趋势)',
    'ads',
    [
      { name: 'table_name', comment: '表名' },
      { name: 'database_name', comment: '数据库名称' },
      { name: 'owner', comment: '负责人' },
    ],
    [
      { name: 'overall_score', type: 'decimal', comment: '综合质量评分' },
      { name: 'failed_rule_count', type: 'bigint', comment: '失败规则数' },
      { name: 'critical_failures', type: 'bigint', comment: '严重失败数' },
      { name: 'score_7d_trend', type: 'decimal', comment: '7日评分趋势' },
      { name: 'last_check_pass_rate', type: 'decimal', comment: '最近一次通过率' },
    ],
  ),
  generateSummaryTable(
    'ads_gov',
    'lineage_dashboard',
    '血缘覆盖看板(覆盖率/断链告警)',
    'ads',
    [
      { name: 'database_name', comment: '数据库名称' },
    ],
    [
      { name: 'table_coverage_rate', type: 'decimal', comment: '表血缘覆盖率' },
      { name: 'column_coverage_rate', type: 'decimal', comment: '字段血缘覆盖率' },
      { name: 'broken_lineage_count', type: 'bigint', comment: '断链数' },
      { name: 'orphan_table_count', type: 'bigint', comment: '孤立表数' },
      { name: 'total_lineage_paths', type: 'bigint', comment: '血缘路径总数' },
    ],
  ),
  generateSummaryTable(
    'ads_gov',
    'metadata_dashboard',
    '元数据完整性看板',
    'ads',
    [
      { name: 'database_name', comment: '数据库名称' },
    ],
    [
      { name: 'completeness_rate', type: 'decimal', comment: '完整性百分比' },
      { name: 'tables_missing_desc', type: 'bigint', comment: '缺描述的表数' },
      { name: 'tables_missing_owner', type: 'bigint', comment: '缺负责人的表数' },
      { name: 'columns_missing_desc', type: 'bigint', comment: '缺描述的字段数' },
      { name: 'stale_table_count', type: 'bigint', comment: '过期元数据表数' },
    ],
  ),
  generateSummaryTable(
    'ads_gov',
    'compliance_dashboard',
    '合规监控看板(违规/整改进度)',
    'ads',
    [
      { name: 'regulation', comment: '法规标准' },
    ],
    [
      { name: 'compliance_rate', type: 'decimal', comment: '合规率' },
      { name: 'open_violations', type: 'bigint', comment: '未关闭违规数' },
      { name: 'critical_violations', type: 'bigint', comment: '严重违规数' },
      { name: 'avg_resolution_days', type: 'decimal', comment: '平均整改天数' },
      { name: 'overdue_count', type: 'bigint', comment: '超期未整改数' },
    ],
  ),
  generateSummaryTable(
    'ads_gov',
    'sla_dashboard',
    'SLA新鲜度达标看板',
    'ads',
    [
      { name: 'sla_level', comment: 'SLA级别' },
    ],
    [
      { name: 'total_tables', type: 'bigint', comment: '监控表数' },
      { name: 'met_rate', type: 'decimal', comment: '达标率' },
      { name: 'breached_count', type: 'bigint', comment: '违约数' },
      { name: 'avg_delay_minutes', type: 'decimal', comment: '平均延迟分钟数' },
      { name: 'worst_delay_minutes', type: 'decimal', comment: '最大延迟分钟数' },
    ],
  ),
  generateSummaryTable(
    'ads_gov',
    'profiling_dashboard',
    'Profiling覆盖与异常看板',
    'ads',
    [
      { name: 'database_name', comment: '数据库名称' },
    ],
    [
      { name: 'coverage_rate', type: 'decimal', comment: 'Profiling覆盖率' },
      { name: 'total_anomalies', type: 'bigint', comment: '异常总数' },
      { name: 'critical_anomalies', type: 'bigint', comment: '严重异常数' },
      { name: 'avg_null_rate', type: 'decimal', comment: '平均空值率' },
      { name: 'tables_needing_profile', type: 'bigint', comment: '待Profiling表数' },
    ],
  ),
  generateSummaryTable(
    'ads_gov',
    'acl_risk_dashboard',
    '权限风险看板(高危权限/越权)',
    'ads',
    [
      { name: 'risk_type', comment: '风险类型' },
    ],
    [
      { name: 'total_risks', type: 'bigint', comment: '风险总数' },
      { name: 'high_risk_count', type: 'bigint', comment: '高危数' },
      { name: 'affected_users', type: 'bigint', comment: '受影响用户数' },
      { name: 'unresolved_count', type: 'bigint', comment: '未处理数' },
    ],
  ),
  generateSummaryTable(
    'ads_gov',
    'storage_cost_dashboard',
    '存储成本看板(按生命周期/格式)',
    'ads',
    [
      { name: 'lifecycle_stage', comment: '生命周期阶段' },
    ],
    [
      { name: 'total_size_tb', type: 'decimal', comment: '总存储(TB)' },
      { name: 'estimated_cost_usd', type: 'decimal', comment: '预估成本(USD)' },
      { name: 'reclaimable_size_tb', type: 'decimal', comment: '可回收存储(TB)' },
      { name: 'table_count', type: 'bigint', comment: '表数量' },
    ],
  ),
  generateSummaryTable(
    'ads_gov',
    'owner_accountability',
    '负责人治理责任看板(按Owner评分)',
    'ads',
    [
      { name: 'owner', comment: '负责人' },
      { name: 'owner_team', comment: '所属团队' },
    ],
    [
      { name: 'managed_tables', type: 'bigint', comment: '管理表数' },
      { name: 'avg_quality_score', type: 'decimal', comment: '平均质量评分' },
      { name: 'sla_met_rate', type: 'decimal', comment: 'SLA达标率' },
      { name: 'open_violations', type: 'bigint', comment: '未关闭违规数' },
      { name: 'metadata_completeness', type: 'decimal', comment: '元数据完整性' },
      { name: 'overall_gov_score', type: 'decimal', comment: '治理综合评分' },
    ],
  ),
  generateSummaryTable(
    'ads_gov',
    'change_impact_report',
    'Schema变更影响报告(变更频率/影响分析)',
    'ads',
    [
      { name: 'database_name', comment: '数据库名称' },
      { name: 'change_type', comment: '变更类型' },
    ],
    [
      { name: 'change_count_7d', type: 'bigint', comment: '7日变更次数' },
      { name: 'change_count_30d', type: 'bigint', comment: '30日变更次数' },
      { name: 'affected_downstream', type: 'bigint', comment: '影响下游数' },
      { name: 'breaking_changes', type: 'bigint', comment: '破坏性变更数' },
    ],
  ),
  generateSummaryTable(
    'ads_gov',
    'tag_governance',
    '标签治理看板(标签覆盖率/使用情况)',
    'ads',
    [
      { name: 'tag_category', comment: '标签分类' },
    ],
    [
      { name: 'total_tags', type: 'bigint', comment: '标签总数' },
      { name: 'used_tags', type: 'bigint', comment: '已使用标签数' },
      { name: 'unused_tags', type: 'bigint', comment: '未使用标签数' },
      { name: 'total_bindings', type: 'bigint', comment: '绑定总数' },
      { name: 'coverage_rate', type: 'decimal', comment: '标签覆盖率' },
    ],
  ),
  generateSummaryTable(
    'ads_gov',
    'dictionary_health',
    '数据字典健康度看板',
    'ads',
    [
      { name: 'category', comment: '字典类别' },
    ],
    [
      { name: 'total_entries', type: 'bigint', comment: '条目总数' },
      { name: 'standardized_rate', type: 'decimal', comment: '标准化率' },
      { name: 'duplicate_count', type: 'bigint', comment: '重复条目数' },
      { name: 'stale_count', type: 'bigint', comment: '过期条目数' },
    ],
  ),
  generateSummaryTable(
    'ads_gov',
    'audit_anomaly_report',
    '审计异常行为报告(异常访问模式)',
    'ads',
    [
      { name: 'anomaly_type', comment: '异常类型: bulk_export/off_hours/sensitive_access/denied_spike' },
      { name: 'operator_dept', comment: '操作人部门' },
    ],
    [
      { name: 'anomaly_count', type: 'bigint', comment: '异常事件数' },
      { name: 'affected_resources', type: 'bigint', comment: '涉及资源数' },
      { name: 'distinct_operators', type: 'bigint', comment: '涉及人员数' },
      { name: 'risk_score', type: 'decimal', comment: '风险评分' },
    ],
  ),
  generateSummaryTable(
    'ads_gov',
    'lifecycle_action_plan',
    '生命周期操作计划(即将到期/待归档)',
    'ads',
    [
      { name: 'action_type', comment: '操作类型: archive/delete/downgrade/extend' },
      { name: 'current_stage', comment: '当前阶段' },
    ],
    [
      { name: 'table_count', type: 'bigint', comment: '表数量' },
      { name: 'total_size_bytes', type: 'bigint', comment: '涉及存储量(字节)' },
      { name: 'due_within_7d', type: 'bigint', comment: '7日内到期' },
      { name: 'due_within_30d', type: 'bigint', comment: '30日内到期' },
    ],
  ),
  generateSummaryTable(
    'ads_gov',
    'job_health_dashboard',
    '作业健康度看板(成功率/耗时)',
    'ads',
    [
      { name: 'job_type', comment: '作业类型' },
    ],
    [
      { name: 'total_jobs', type: 'bigint', comment: '作业总数' },
      { name: 'success_rate', type: 'decimal', comment: '成功率' },
      { name: 'avg_duration_sec', type: 'decimal', comment: '平均时长(秒)' },
      { name: 'failed_today', type: 'bigint', comment: '今日失败数' },
      { name: 'long_running_count', type: 'bigint', comment: '长时间运行数' },
    ],
  ),
  generateSummaryTable(
    'ads_gov',
    'governance_weekly_report',
    '治理周报汇总(各维度周变化)',
    'ads',
    [
      { name: 'report_week', comment: '报告周' },
      { name: 'dimension', comment: '治理维度' },
    ],
    [
      { name: 'current_score', type: 'decimal', comment: '本周评分' },
      { name: 'prev_score', type: 'decimal', comment: '上周评分' },
      { name: 'score_change', type: 'decimal', comment: '评分变化' },
      { name: 'new_issues', type: 'bigint', comment: '新增问题数' },
      { name: 'resolved_issues', type: 'bigint', comment: '已解决问题数' },
    ],
  ),
  generateSummaryTable(
    'ads_gov',
    'sensitive_data_map',
    '敏感数据地图(按敏感级别/分布)',
    'ads',
    [
      { name: 'database_name', comment: '数据库名称' },
      { name: 'sensitivity_level', comment: '敏感级别' },
    ],
    [
      { name: 'table_count', type: 'bigint', comment: '表数量' },
      { name: 'column_count', type: 'bigint', comment: '字段数量' },
      { name: 'encrypted_count', type: 'bigint', comment: '已加密字段数' },
      { name: 'masked_count', type: 'bigint', comment: '已脱敏字段数' },
      { name: 'unprotected_count', type: 'bigint', comment: '未保护字段数' },
    ],
  ),
  generateSummaryTable(
    'ads_gov',
    'cross_domain_impact',
    '跨域影响力分析(表被引用/依赖度)',
    'ads',
    [
      { name: 'table_name', comment: '表名' },
      { name: 'database_name', comment: '数据库名称' },
    ],
    [
      { name: 'upstream_count', type: 'bigint', comment: '上游依赖数' },
      { name: 'downstream_count', type: 'bigint', comment: '下游影响数' },
      { name: 'total_column_lineages', type: 'bigint', comment: '字段血缘总数' },
      { name: 'consumer_count', type: 'bigint', comment: '消费者数(人)' },
      { name: 'criticality_score', type: 'decimal', comment: '关键性评分' },
    ],
  ),
  generateSummaryTable(
    'ads_gov',
    'executive_summary',
    '治理Executive Summary(给管理层的一页报告)',
    'ads',
    [
      { name: 'report_date', comment: '报告日期' },
    ],
    [
      { name: 'total_tables', type: 'bigint', comment: '管理表总数' },
      { name: 'quality_score', type: 'decimal', comment: '数据质量评分' },
      { name: 'lineage_coverage', type: 'decimal', comment: '血缘覆盖率' },
      { name: 'compliance_rate', type: 'decimal', comment: '合规率' },
      { name: 'sla_met_rate', type: 'decimal', comment: 'SLA达标率' },
      { name: 'metadata_completeness', type: 'decimal', comment: '元数据完整性' },
      { name: 'open_critical_issues', type: 'bigint', comment: '严重未解决问题数' },
      { name: 'overall_gov_score', type: 'decimal', comment: '治理综合评分' },
    ],
  ),
];

/* ------------------------------------------------------------------ */
/*  Metrics                                                            */
/* ------------------------------------------------------------------ */

const metrics: DomainDefinition['metrics'] = [
  {
    name: 'data_quality_score',
    displayName: '数据质量评分',
    expression: 'AVG(overall_score)',
    metricType: 'atomic',
    sourceTable: 'dws_gov_dq_table_score',
    dimensions: ['database_name', 'owner'],
    granularity: ['daily', 'weekly'],
    format: 'number',
    description: '基于完整性、准确性、一致性、时效性四维度加权计算的表级综合质量评分(0-100)',
  },
  {
    name: 'lineage_coverage_rate',
    displayName: '血缘覆盖率',
    expression: 'SUM(tables_with_lineage) / NULLIF(SUM(total_tables), 0)',
    metricType: 'derived',
    sourceTable: 'dws_gov_lineage_coverage',
    dimensions: ['database_name', 'schema_name'],
    granularity: ['daily'],
    format: 'percentage',
    description: '有血缘关系记录的表占全部表的比例，衡量血缘建设的覆盖程度',
  },
  {
    name: 'metadata_completeness_rate',
    displayName: '元数据完整性',
    expression: 'AVG(completeness_rate)',
    metricType: 'atomic',
    sourceTable: 'dws_gov_metadata_completeness',
    dimensions: ['database_name', 'schema_name'],
    granularity: ['daily'],
    format: 'percentage',
    description: '元数据(表描述、字段描述、负责人等)填写完整的比例',
  },
  {
    name: 'compliance_rate',
    displayName: '合规率',
    expression: 'SUM(compliant_count) / NULLIF(SUM(total_checks), 0)',
    metricType: 'derived',
    sourceTable: 'dws_gov_compliance_summary',
    dimensions: ['regulation', 'category'],
    granularity: ['daily', 'weekly'],
    format: 'percentage',
    description: '通过合规检查的资源占全部检查资源的比例(按法规/类别)',
  },
  {
    name: 'sla_freshness_met_rate',
    displayName: '数据新鲜度SLA达标率',
    expression: 'SUM(met_count) / NULLIF(SUM(total_tables), 0)',
    metricType: 'derived',
    sourceTable: 'dws_gov_sla_daily_summary',
    dimensions: ['sla_level', 'database_name'],
    granularity: ['daily'],
    format: 'percentage',
    description: '在约定SLA时间窗口内完成数据产出的表占监控表总数的比例',
  },
  {
    name: 'profiling_coverage_rate',
    displayName: 'Profiling覆盖率',
    expression: 'SUM(profiled_columns) / NULLIF(SUM(total_columns), 0)',
    metricType: 'derived',
    sourceTable: 'dws_gov_profiling_summary',
    dimensions: ['database_name', 'schema_name'],
    granularity: ['daily'],
    format: 'percentage',
    description: '已完成Data Profiling的字段占全部字段的比例',
  },
];

/* ------------------------------------------------------------------ */
/*  Glossary                                                           */
/* ------------------------------------------------------------------ */

const glossary: DomainDefinition['glossary'] = [
  {
    term: '元数据',
    sqlExpression: "SELECT * FROM ods_meta_table WHERE lifecycle_status = 'active'",
    description: '描述数据的数据，包括表名、字段名、数据类型、负责人、存储格式等结构化信息，是数据治理的基础底座',
  },
  {
    term: '数据血缘',
    sqlExpression: "SELECT s.table_name AS source, t.table_name AS target, l.lineage_type FROM ods_lineage_table l JOIN ods_meta_table s ON l.source_table_id = s.id JOIN ods_meta_table t ON l.target_table_id = t.id WHERE l.is_active = true",
    description: '数据从源头到消费端的流转路径追踪，包括表级血缘和字段级血缘，用于影响分析和根因定位',
  },
  {
    term: '数据质量',
    sqlExpression: "SELECT rule_name, rule_type, severity FROM ods_dq_rule WHERE is_enabled = true ORDER BY severity",
    description: '通过完整性、准确性、一致性、时效性、唯一性、有效性六个维度衡量数据是否满足业务使用要求',
  },
  {
    term: '数据分类',
    sqlExpression: "SELECT sensitivity_level, category, COUNT(*) AS cnt FROM ods_classification_result GROUP BY sensitivity_level, category",
    description: '根据数据内容的敏感程度(公开/内部/机密/受限)和类别(PII/金融/健康等)对字段进行自动或人工标注',
  },
  {
    term: '数据生命周期',
    sqlExpression: "SELECT p.policy_name, b.current_stage, COUNT(*) AS table_cnt FROM ods_lifecycle_binding b JOIN ods_lifecycle_policy p ON b.policy_id = p.id GROUP BY p.policy_name, b.current_stage",
    description: '数据从创建到归档/删除的全过程管理，包括热/温/冷/归档四阶段流转策略，用于控制存储成本和合规要求',
  },
  {
    term: '数据字典',
    sqlExpression: "SELECT dict_code, dict_name, category, item_key, item_value FROM dwd_data_dictionary WHERE is_standard = true ORDER BY dict_code, sort_order",
    description: '对业务术语、枚举值、编码规则的标准化定义集合，确保全组织对同一概念使用统一口径',
  },
];

/* ------------------------------------------------------------------ */
/*  Knowledge Docs                                                     */
/* ------------------------------------------------------------------ */

const knowledgeDocs: DomainDefinition['knowledgeDocs'] = [
  {
    title: '数据治理中心使用指南',
    content: `# 数据治理中心使用指南

## 核心概念
数据治理中心覆盖元数据管理、数据质量、数据血缘、数据分类、权限管控、合规管理、生命周期管理等治理领域。

## 数据分层
- ODS层：原始业务数据，包含元数据注册、质量规则、血缘关系、权限记录等基础表
- DWD层：明细数据，关联多表形成完整视图（如表元数据明细关联了库/Schema/Owner信息）
- DWS层：汇总数据，按维度聚合的指标表（如按库维度的质量评分汇总）
- ADS层：应用数据，面向看板和报告的宽表（如治理健康度总览、Executive Summary）

## 常用查询场景
1. 查看某张表的质量评分：查询 dws_gov_dq_table_score，按 table_name 过滤
2. 追踪表血缘：查询 dwd_lineage_full，指定 source_table 或 target_table
3. 查看敏感数据分布：查询 ads_gov_sensitive_data_map，按 sensitivity_level 分组
4. 检查SLA达标情况：查询 ads_gov_sla_dashboard，关注 breached_count
5. 查看合规违规：查询 dwd_compliance_violation，按 remediation_status 过滤
6. 查看负责人治理评分：查询 ads_gov_owner_accountability，按 owner 排序`,
    docType: 'document',
  },
];

/* ------------------------------------------------------------------ */
/*  Conversations                                                      */
/* ------------------------------------------------------------------ */

const conversations: DomainDefinition['conversations'] = [
  {
    title: '数据治理综合查询',
    messages: [
      {
        role: 'user',
        content: '帮我看看整体数据质量评分最低的10张表',
      },
      {
        role: 'assistant',
        content: '以下是综合质量评分最低的10张表，包含各维度评分和负责人信息。',
        sql: `SELECT
  table_name,
  database_name,
  owner,
  completeness_score,
  accuracy_score,
  consistency_score,
  timeliness_score,
  overall_score,
  rule_count
FROM dws_gov_dq_table_score
WHERE ds = CURRENT_DATE
ORDER BY overall_score ASC
LIMIT 10`,
        confidence: 0.95,
      },
      {
        role: 'user',
        content: '这些表里有哪些存在合规违规还没处理的？',
      },
      {
        role: 'assistant',
        content: '关联合规违规表，找出质量评分最低且有未关闭违规的表。',
        sql: `SELECT
  v.resource_name AS table_name,
  v.regulation,
  v.violation_type,
  v.severity,
  v.remediation_status,
  v.detected_at,
  q.overall_score AS quality_score
FROM dwd_compliance_violation v
JOIN dws_gov_dq_table_score q
  ON v.resource_name = q.table_name AND q.ds = CURRENT_DATE
WHERE v.remediation_status IN ('open', 'in_progress')
  AND v.ds = CURRENT_DATE
  AND q.overall_score <= (
    SELECT overall_score FROM dws_gov_dq_table_score
    WHERE ds = CURRENT_DATE
    ORDER BY overall_score ASC
    LIMIT 1 OFFSET 9
  )
ORDER BY v.severity, q.overall_score ASC`,
        confidence: 0.88,
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Query History                                                      */
/* ------------------------------------------------------------------ */

const queryHistory: DomainDefinition['queryHistory'] = [
  {
    naturalLanguage: '查看所有P0级别SLA违约的表和延迟时间',
    generatedSql: `SELECT
  table_name,
  sla_level,
  expected_ready_time,
  actual_ready_time,
  delay_minutes,
  check_result
FROM dwd_sla_check_result
WHERE ds = CURRENT_DATE
  AND sla_level = 'P0'
  AND check_result = 'breached'
ORDER BY delay_minutes DESC`,
    status: 'accepted',
    isGolden: true,
    tablesUsed: ['dwd_sla_check_result'],
  },
  {
    naturalLanguage: '统计各数据库的血缘覆盖率，按覆盖率升序',
    generatedSql: `SELECT
  database_name,
  schema_name,
  total_tables,
  tables_with_lineage,
  lineage_coverage_rate,
  total_columns,
  columns_with_lineage,
  column_coverage_rate
FROM dws_gov_lineage_coverage
WHERE ds = CURRENT_DATE
ORDER BY lineage_coverage_rate ASC`,
    status: 'accepted',
    isGolden: true,
    tablesUsed: ['dws_gov_lineage_coverage'],
  },
  {
    naturalLanguage: '找出最近7天内Schema变更次数最多的表',
    generatedSql: `SELECT
  table_name,
  database_name,
  COUNT(*) AS change_count,
  ARRAY_AGG(DISTINCT change_type) AS change_types,
  ARRAY_AGG(DISTINCT changed_by) AS operators
FROM dwd_schema_change_detail
WHERE ds >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY table_name, database_name
ORDER BY change_count DESC
LIMIT 20`,
    status: 'accepted',
    isGolden: false,
    tablesUsed: ['dwd_schema_change_detail'],
  },
];

/* ------------------------------------------------------------------ */
/*  Domain Export                                                       */
/* ------------------------------------------------------------------ */

export const dataGovernanceDomain: DomainDefinition = {
  name: '数据治理中心',
  description:
    '覆盖元数据管理、数据质量、数据血缘、数据分类、权限管控、审计追踪、合规管理、生命周期管理、数据字典、SLA监控等数据治理全链路的领域模型',
  dialect: 'postgresql',
  tables: [...odsTables, ...dwdTables, ...dwsTables, ...adsTables],
  metrics,
  glossary,
  knowledgeDocs,
  conversations,
  queryHistory,
};
