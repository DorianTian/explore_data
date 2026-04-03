import Anthropic from '@anthropic-ai/sdk';
import type { IntentResult, ConversationTurn } from './types.js';

const INTENT_PROMPT = `You are an intent classifier for a NL2SQL system. Classify the user's message into one of these categories:

- sql_query: The user wants to query data (asking about numbers, lists, comparisons, aggregations, etc.)
- follow_up: The user is modifying or refining a previous query (e.g., "按月拆分", "加上去年的对比", "排除测试数据")
- clarification: The user is asking about the schema, available data, or needs help formulating their question
- off_topic: Not related to data querying

Respond in JSON format: { "type": "sql_query|follow_up|clarification|off_topic", "confidence": 0.0-1.0, "modificationHint": "optional, only for follow_up" }`;

export class IntentClassifier {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey });
  }

  async classify(
    userQuery: string,
    conversationHistory: ConversationTurn[] = [],
  ): Promise<IntentResult> {
    const messages: Anthropic.MessageParam[] = [];

    if (conversationHistory.length > 0) {
      const historyText = conversationHistory
        .slice(-4)
        .map((t) => `${t.role}: ${t.content}${t.sql ? `\n[SQL: ${t.sql}]` : ''}`)
        .join('\n');

      messages.push({
        role: 'user',
        content: `Previous conversation:\n${historyText}\n\nNew message to classify: "${userQuery}"`,
      });
    } else {
      messages.push({
        role: 'user',
        content: `Classify this message: "${userQuery}"`,
      });
    }

    const response = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: INTENT_PROMPT,
      messages,
    });

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as IntentResult;
      }
    } catch {
      // fallback
    }

    return { type: 'sql_query', confidence: 0.5 };
  }
}
