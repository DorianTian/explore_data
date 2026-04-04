import Anthropic from '@anthropic-ai/sdk';
import type { IntentResult, ConversationTurn } from './types.js';
import { extractText, extractJson, withRetry } from './llm-utils.js';
import { MODEL, TIMEOUT } from './config.js';

const INTENT_PROMPT = `你是一个 NL2SQL 系统的意图分类器。将用户的消息分类为以下类别之一：

- sql_query: 用户想查询数据（问数字、列表、对比、聚合、趋势等）
- follow_up: 用户在修改或细化上一条查询（如"按月拆分"、"加上同比"、"去掉测试数据"、"改成柱状图"）
- clarification: 用户在询问有哪些数据、字段含义，或需要帮助构建查询
- off_topic: 与数据查询无关的闲聊

判断规则：
1. 如果有对话历史且用户消息很短（如"按月看"、"排个序"），大概率是 follow_up
2. 包含"什么是"、"有哪些表"、"字段含义"等词时是 clarification
3. 包含数据相关关键词（销售额、用户数、订单、增长率等）时是 sql_query
4. 有疑问句式（多少、哪些、什么时候）且涉及数据时是 sql_query

返回 JSON: { "type": "sql_query|follow_up|clarification|off_topic", "confidence": 0.0-1.0, "modificationHint": "仅 follow_up 时填写，描述修改意图" }`;

export class IntentClassifier {
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
  ): Promise<IntentResult> {
    const messages: Anthropic.MessageParam[] = [];

    if (conversationHistory.length > 0) {
      const historyText = conversationHistory
        .slice(-4)
        .map(
          (t) =>
            `${t.role === 'user' ? '用户' : '系统'}: ${t.content}${t.sql ? `\n[SQL: ${t.sql}]` : ''}`,
        )
        .join('\n');

      messages.push({
        role: 'user',
        content: `对话历史:\n${historyText}\n\n需要分类的新消息: "${userQuery}"`,
      });
    } else {
      messages.push({
        role: 'user',
        content: `分类这条消息: "${userQuery}"`,
      });
    }

    const response = await withRetry(
      () =>
        this.client.messages.create(
          {
            model: MODEL.classification,
            max_tokens: 200,
            system: INTENT_PROMPT,
            messages,
          },
          { timeout: TIMEOUT.fast },
        ),
      { label: 'IntentClassifier' },
    );

    const text = extractText(response);
    const parsed = extractJson<IntentResult>(text);

    return parsed ?? { type: 'sql_query', confidence: 0.5 };
  }
}
