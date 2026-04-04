import type Anthropic from '@anthropic-ai/sdk';

/**
 * Minimal structured logger for engine package.
 * Engine is a library consumed by the API server — keeps pino as an API-only dep.
 */
const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';
const LEVELS: Record<string, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const currentLevel = LEVELS[LOG_LEVEL] ?? 20;

const logger = {
  warn(ctx: Record<string, unknown>, msg: string) {
    if (currentLevel <= 30) {
      process.stderr.write(JSON.stringify({ level: 'warn', msg, ...ctx }) + '\n');
    }
  },
  error(ctx: Record<string, unknown>, msg: string) {
    if (currentLevel <= 40) {
      process.stderr.write(JSON.stringify({ level: 'error', msg, ...ctx }) + '\n');
    }
  },
};

/**
 * Safely extract text from an Anthropic message response.
 * Handles empty content arrays and non-text blocks.
 */
export function extractText(response: Anthropic.Message): string {
  if (!response.content || response.content.length === 0) {
    logger.warn({ id: response.id }, 'LLM returned empty content array');
    return '';
  }
  const block = response.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') {
    logger.warn({ id: response.id }, 'LLM returned no text block');
    return '';
  }
  return block.text;
}

/**
 * Extract the FIRST complete JSON object from LLM text output.
 * Uses bracket counting instead of greedy regex to handle multiple JSON objects.
 * Returns null if no valid JSON found.
 */
export function extractJson<T = unknown>(text: string): T | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        try {
          return JSON.parse(candidate) as T;
        } catch {
          logger.warn({ text: candidate.slice(0, 200) }, 'JSON parse failed on extracted object');
          return null;
        }
      }
    }
  }

  return null;
}

/**
 * Wrap an async LLM call with exponential backoff retry.
 * Retries on transient errors (rate limit, server errors).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; label?: string } = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2;
  const label = options.label ?? 'LLM call';

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const isRetryable = isTransientError(err);

      if (!isRetryable || attempt === maxRetries) {
        logger.error(
          { err, label, attempt, maxRetries },
          `${label} failed (non-retryable or max retries reached)`,
        );
        throw err;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
      logger.warn({ label, attempt, delay }, `${label} failed, retrying...`);
      await sleep(delay);
    }
  }

  throw lastError;
}

function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  // Anthropic/OpenAI rate limit or server errors
  if (msg.includes('rate_limit') || msg.includes('429')) return true;
  if (msg.includes('overloaded') || msg.includes('503')) return true;
  if (msg.includes('internal_error') || msg.includes('500')) return true;
  if (msg.includes('timeout') || msg.includes('econnreset')) return true;
  // Check status property from API SDK errors
  const status = (err as { status?: number }).status;
  if (status && (status === 429 || status === 500 || status === 503 || status === 529)) return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
