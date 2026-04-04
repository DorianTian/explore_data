export interface SSEEvent {
  event: string;
  data: unknown;
}

export type SSEHandler = (event: SSEEvent) => void;

/**
 * Connect to an SSE endpoint using fetch + ReadableStream.
 * Returns an abort function.
 */
export function connectSSE(
  url: string,
  body: unknown,
  onEvent: SSEHandler,
  onError: (error: Error) => void,
  onDone: () => void,
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`SSE request failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';
      let currentData = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            currentData = currentData ? `${currentData}\n${line.slice(6)}` : line.slice(6);
          } else if (line === '' && currentData) {
            const eventName = currentEvent || 'message';
            try {
              const parsed = JSON.parse(currentData);
              onEvent({ event: eventName, data: parsed });
            } catch {
              onEvent({ event: eventName, data: currentData });
            }
            currentEvent = '';
            currentData = '';
          }
        }
      }

      onDone();
    } catch (err) {
      if (controller.signal.aborted) return;
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return () => controller.abort();
}
