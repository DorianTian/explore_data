import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { ClassificationResult } from './types.js';
import type { ConversationTurn } from '../types.js';

const classificationSchema = z.object({
  type: z.enum(['sql_query', 'follow_up', 'clarification', 'off_topic']),
  complexity: z.enum(['simple', 'moderate', 'complex']),
  confidence: z.number().min(0).max(1),
  modificationHint: z.string().optional(),
  reason: z.string(),
});

const ROUTER_PROMPT = `你是一个 NL2SQL 查询路由器。分析用户的查询，判断类型和复杂度。

## 类型判断
- sql_query: 用户要查数据
- follow_up: 修改上一条查询（如"按月看""排个序""换成柱状图"）
- clarification: 问有什么数据/字段/表
- off_topic: 与数据查询无关

## 复杂度判断
- simple: 单表查询、简单聚合、单维度分组（如"用户总数""各渠道订单数"）
- moderate: 双表 JOIN、带时间过滤、多条件（如"完成订单的用户消费排名"）
- complex: 多表 JOIN + 嵌套子查询、对比/同比/排名后再分析、需要 CTE 或窗口函数

## 示例

用户: "用户总数"
→ {"type":"sql_query","complexity":"simple","confidence":0.95,"reason":"单表 COUNT 聚合"}

用户: "各渠道完成订单的GMV趋势"
→ {"type":"sql_query","complexity":"moderate","confidence":0.9,"reason":"双表 JOIN + 时间维度 + 状态过滤"}

用户: "消费金额超过平均值的用户有哪些品类偏好"
→ {"type":"sql_query","complexity":"complex","confidence":0.85,"reason":"子查询 + 多表 JOIN + 嵌套聚合"}

用户: "帮我排个序"（有对话历史）
→ {"type":"follow_up","complexity":"simple","confidence":0.9,"modificationHint":"添加 ORDER BY","reason":"修改上条查询的排序"}

用户: "有哪些表可以查"
→ {"type":"clarification","complexity":"simple","confidence":0.95,"reason":"询问数据结构"}

用户: "今天天气怎么样"
→ {"type":"off_topic","complexity":"simple","confidence":0.95,"reason":"与数据查询无关"}

返回 JSON（严格按上述字段格式）:`;

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
        .map(
          (t) =>
            `${t.role === 'user' ? '用户' : '系统'}: ${t.content}${t.sql ? ` [SQL: ${t.sql}]` : ''}`,
        )
        .join('\n');
      messages.push({
        role: 'user',
        content: `对话历史:\n${historyText}\n\n新消息: "${userQuery}"`,
      });
    } else {
      messages.push({ role: 'user', content: `分类: "${userQuery}"` });
    }

    let text = '';
    try {
      const response = await this.client.messages.create(
        {
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: ROUTER_PROMPT,
          messages,
        },
        { timeout: 10_000 },
      );
      text = response.content[0].type === 'text' ? response.content[0].text : '';
    } catch {
      return this.heuristicFallback(userQuery, conversationHistory);
    }

    try {
      const match = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
      if (match) {
        return classificationSchema.parse(JSON.parse(match[0]));
      }
    } catch {
      // Zod or JSON parse failed
    }

    return this.heuristicFallback(userQuery, conversationHistory);
  }

  /** Rule-based fallback when LLM classification fails */
  private heuristicFallback(
    userQuery: string,
    conversationHistory: ConversationTurn[],
  ): ClassificationResult {
    const q = userQuery.toLowerCase();

    const offTopicPatterns = ['天气', '你好', '谢谢', '再见', 'hello', 'hi', 'thanks'];
    if (offTopicPatterns.some((p) => q === p || (q.length < 10 && q.includes(p)))) {
      return {
        type: 'off_topic',
        complexity: 'simple',
        confidence: 0.7,
        reason: 'heuristic: greeting/off-topic',
      };
    }

    const clarificationPatterns = ['有哪些表', '什么字段', '数据结构', '可以查什么', '有什么数据'];
    if (clarificationPatterns.some((p) => q.includes(p))) {
      return {
        type: 'clarification',
        complexity: 'simple',
        confidence: 0.7,
        reason: 'heuristic: schema question',
      };
    }

    if (conversationHistory.length > 0 && q.length < 20) {
      const followUpPatterns = [
        '排序',
        '排个序',
        '倒序',
        '按月',
        '按天',
        '加个',
        '去掉',
        '换成',
        '改成',
        '限制',
      ];
      if (followUpPatterns.some((p) => q.includes(p))) {
        return {
          type: 'follow_up',
          complexity: 'simple',
          confidence: 0.6,
          modificationHint: userQuery,
          reason: 'heuristic: short modification',
        };
      }
    }

    const complexPatterns = ['同比', '环比', '对比', '超过平均', '排名.*的.*率', 'CTE', '窗口函数'];
    if (complexPatterns.some((p) => new RegExp(p).test(q))) {
      return {
        type: 'sql_query',
        complexity: 'complex',
        confidence: 0.5,
        reason: 'heuristic: complex pattern',
      };
    }

    return {
      type: 'sql_query',
      complexity: 'moderate',
      confidence: 0.5,
      reason: 'heuristic: fallback',
    };
  }
}
