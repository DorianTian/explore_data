import type { ToolDefinition } from './types.js';

/**
 * Skill definitions for the NL2SQL Agent.
 * Each skill maps to a Claude tool_use tool definition.
 */
export const SKILL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'schema_search',
    description:
      '搜索数据库 schema，获取相关的表和列信息。当你需要了解数据库结构来生成 SQL 时使用。',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '要搜索的内容，用自然语言描述需要哪些表/列',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'metric_lookup',
    description: '查找已定义的业务指标。当用户提到 GMV、订单数、客单价等业务指标时使用。',
    input_schema: {
      type: 'object',
      properties: {
        metricName: {
          type: 'string',
          description: '指标名称或关键词',
        },
      },
      required: ['metricName'],
    },
  },
  {
    name: 'knowledge_search',
    description: '搜索知识库中的业务规则和文档。当需要了解业务逻辑、术语定义或数据口径时使用。',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '要搜索的业务知识内容',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'sql_generate',
    description: '根据 schema、业务知识和用户问题生成 SQL。这是核心生成步骤。',
    input_schema: {
      type: 'object',
      properties: {
        userQuery: {
          type: 'string',
          description: '用户的查询需求',
        },
        schemaContext: {
          type: 'string',
          description: '相关的数据库 schema（DDL 格式）',
        },
        additionalContext: {
          type: 'string',
          description: '额外上下文（业务知识、术语、历史查询等）',
        },
      },
      required: ['userQuery', 'schemaContext'],
    },
  },
  {
    name: 'sql_review',
    description:
      '审查生成的 SQL 是否正确回答了用户问题。检查语义、JOIN、过滤条件、聚合粒度等。如果有问题会返回修正建议。',
    input_schema: {
      type: 'object',
      properties: {
        userQuery: {
          type: 'string',
          description: '用户原始问题',
        },
        sql: {
          type: 'string',
          description: '要审查的 SQL',
        },
        schemaContext: {
          type: 'string',
          description: '数据库 schema 上下文',
        },
      },
      required: ['userQuery', 'sql'],
    },
  },
  {
    name: 'sql_validate',
    description:
      '校验 SQL 的语法和安全性。检查是否有 DDL/DML 语句、SQL 注入风险、表/列是否存在等。',
    input_schema: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description: '要校验的 SQL',
        },
      },
      required: ['sql'],
    },
  },
  {
    name: 'chart_recommend',
    description: '根据查询意图和数据结构推荐合适的图表类型。',
    input_schema: {
      type: 'object',
      properties: {
        userQuery: {
          type: 'string',
          description: '用户查询',
        },
        columns: {
          type: 'string',
          description: '返回的列信息（名称和类型）',
        },
      },
      required: ['userQuery'],
    },
  },
];
