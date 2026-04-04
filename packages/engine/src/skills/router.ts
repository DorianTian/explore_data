import Anthropic from '@anthropic-ai/sdk';
import type { ClassificationResult } from './types.js';
import type { ConversationTurn } from '../types.js';

const ROUTER_PROMPT = `你是一个 NL2SQL 查询路由器。分析用户的查询，判断类型和复杂度。

## 类型判断
- sql_query: 用户要查数据
- follow_up: 修改上一条查询（如"按月看""排个序"）
- clarification: 问有什么数据/字段
- off_topic: 无关

## 复杂度判断
- simple: 单表查询、简单聚合、单维度分组（如"用户总数""各渠道订单数"）
- moderate: 双表 JOIN、带时间过滤、多条件（如"完成订单的用户消费排名"）
- complex: 多表 JOIN + 嵌套子查询、对比/同比/排名后再分析、需要 CTE 或窗口函数

返回 JSON:
{
  "type": "sql_query",
  "complexity": "simple",
  "confidence": 0.95,
  "reason": "单表 COUNT 聚合"
}`;

export class QueryRouter {
  private client: Anthropic;

  constructor(apiKey?: string, baseURL?: string) {
    this.client = new Anthropic({
      apiKey,
      baseURL: baseURL ?? process.env.ANTHROPIC_BASE_URL ?? undefined,
    });
  }

  async classify(
    userQuery: string,
    conversationHistory: ConversationTurn[] = [],
  ): Promise<ClassificationResult> {
    const messages: Anthropic.MessageParam[] = [];

    if (conversationHistory.length > 0) {
      const historyText = conversationHistory
        .slice(-4)
        .map((t) => `${t.role === 'user' ? '用户' : '系统'}: ${t.content}${t.sql ? ` [SQL: ${t.sql}]` : ''}`)
        .join('\n');
      messages.push({
        role: 'user',
        content: `对话历史:\n${historyText}\n\n新消息: "${userQuery}"`,
      });
    } else {
      messages.push({ role: 'user', content: `分类: "${userQuery}"` });
    }

    const response = await this.client.messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: ROUTER_PROMPT,
        messages,
      },
      { timeout: 10_000 },
    );

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]) as ClassificationResult;
    } catch {
      // fallback
    }

    return {
      type: 'sql_query',
      complexity: 'moderate',
      confidence: 0.5,
      reason: 'fallback',
    };
  }
}
