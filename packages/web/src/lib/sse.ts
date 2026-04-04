export interface SSEEvent {
  event: string;
  data: unknown;
}

export type SSEHandler = (event: SSEEvent) => void;

/**
 * Yield control back to the browser so React can flush state updates.
 * This prevents React 18 automatic batching from collapsing all SSE
 * events into a single render (which would skip intermediate states).
 */
function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Connect to an SSE endpoint using fetch + ReadableStream.
 * Returns an abort function.
 *
 * Events are dispatched with a microtask yield between each one
 * so React renders intermediate pipeline status updates.
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
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: 'no-store',
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
        if (done) {
          buffer += decoder.decode();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        // Collect events from this chunk, then dispatch with yields
        const events: SSEEvent[] = [];

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            currentData = currentData ? `${currentData}\n${line.slice(6)}` : line.slice(6);
          } else if (line === '') {
            if (currentData) {
              const eventName = currentEvent || 'message';
              try {
                const parsed = JSON.parse(currentData);
                events.push({ event: eventName, data: parsed });
              } catch {
                events.push({ event: eventName, data: currentData });
              }
            }
            currentEvent = '';
            currentData = '';
          }
        }

        // Dispatch each event with a yield so React can render between them
        for (const evt of events) {
          onEvent(evt);
          // Yield after status events to let React render the pipeline step
          if (evt.event === 'status') {
            await yieldToBrowser();
          }
        }
      }

      // Dispatch any buffered event not terminated by a trailing blank line
      if (currentData) {
        const eventName = currentEvent || 'message';
        try {
          const parsed = JSON.parse(currentData);
          onEvent({ event: eventName, data: parsed });
        } catch {
          onEvent({ event: eventName, data: currentData });
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
