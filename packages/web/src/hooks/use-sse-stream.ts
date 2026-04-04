'use client';

import { useCallback, useRef } from 'react';
import { connectSSE, type SSEEvent } from '@/lib/sse';
import { useChatStore, type PipelineStep, type ChatMessage } from '@/stores/chat-store';
import { usePanelStore } from '@/stores/panel-store';
import { useProjectStore } from '@/stores/project-store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3100';

export function useSSEStream() {
  const abortRef = useRef<(() => void) | null>(null);

  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const appendContent = useChatStore((s) => s.appendContent);
  const setLoading = useChatStore((s) => s.setLoading);
  const setConversationId = useChatStore((s) => s.setConversationId);
  const setPipelineStatus = useChatStore((s) => s.setPipelineStatus);
  const conversationId = useChatStore((s) => s.conversationId);

  const openArtifact = usePanelStore((s) => s.openArtifact);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const currentDatasourceId = useProjectStore((s) => s.currentDatasourceId);

  const sendQuery = useCallback(
    (
      query: string,
      conversationHistory: Array<{
        role: string;
        content: string;
        sql?: string;
      }>,
    ) => {
      if (!currentProjectId || !currentDatasourceId) return;

      abortRef.current?.();

      const userMessageId = crypto.randomUUID();
      const assistantMessageId = crypto.randomUUID();

      addMessage({ id: userMessageId, role: 'user', content: query });
      addMessage({
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        isStreaming: true,
      });

      setLoading(true);

      const handleEvent = (event: SSEEvent) => {
        const data = event.data as Record<string, unknown>;

        switch (event.event) {
          case 'conversation':
            setConversationId(data.id as string);
            break;

          case 'status':
            setPipelineStatus(assistantMessageId, {
              currentStep: data.step as PipelineStep,
              message: data.message as string,
              completedSteps: [],
            });
            break;

          case 'token':
            appendContent(assistantMessageId, data.text as string);
            break;

          case 'result':
            updateMessage(assistantMessageId, {
              content: (data.explanation as string) ?? '',
              sql: data.sql as string | undefined,
              confidence: data.confidence as number | undefined,
              tablesUsed: data.tablesUsed as string[] | undefined,
              isStreaming: false,
              pipelineStatus: undefined,
            });
            openArtifact(assistantMessageId, 'sql');
            break;

          case 'execution_result':
            updateMessage(assistantMessageId, {
              executionResult: data as ChatMessage['executionResult'],
            });
            break;

          case 'chart':
            updateMessage(assistantMessageId, {
              chartRecommendation: data as ChatMessage['chartRecommendation'],
            });
            break;

          case 'error':
            updateMessage(assistantMessageId, {
              content: `查询出错: ${data.message}`,
              isStreaming: false,
              pipelineStatus: undefined,
            });
            setLoading(false);
            break;
        }
      };

      const handleError = (error: Error) => {
        updateMessage(assistantMessageId, {
          content: `连接失败: ${error.message}`,
          isStreaming: false,
          pipelineStatus: undefined,
        });
        setLoading(false);
      };

      const handleDone = () => {
        updateMessage(assistantMessageId, { isStreaming: false, pipelineStatus: undefined });
        setLoading(false);
      };

      abortRef.current = connectSSE(
        `${API_BASE}/api/query/stream`,
        {
          projectId: currentProjectId,
          datasourceId: currentDatasourceId,
          query,
          conversationId: conversationId ?? undefined,
          conversationHistory,
        },
        handleEvent,
        handleError,
        handleDone,
      );
    },
    [
      currentProjectId,
      currentDatasourceId,
      conversationId,
      addMessage,
      updateMessage,
      appendContent,
      setLoading,
      setConversationId,
      setPipelineStatus,
      openArtifact,
    ],
  );

  const abort = useCallback(() => {
    abortRef.current?.();
    setLoading(false);
  }, [setLoading]);

  return { sendQuery, abort };
}
