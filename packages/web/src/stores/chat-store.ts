import { create } from 'zustand';
import { apiFetch, apiDelete } from '@/lib/api';

/** Pipeline step identifier — extensible, backend may send any step name */
export type PipelineStep = string;

/** Conversation summary returned by the list endpoint */
export interface ConversationSummary {
  id: string;
  projectId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStepEntry {
  step: string;
  message: string;
  /** Reasoning content from the pipeline step */
  thinking?: string;
  /** Structured data payload from the pipeline step */
  data?: unknown;
}

export interface PipelineStatus {
  currentStep: string;
  message: string;
  /** Reasoning content from the current step */
  thinking?: string;
  /** Structured data payload from the current step */
  data?: unknown;
  /** Cumulative log of all steps — displayed as a list like ChatGPT thinking */
  steps: PipelineStepEntry[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  confidence?: number;
  feedback?: 'accepted' | 'rejected';
  isGolden?: boolean;
  isStreaming?: boolean;
  executionResult?: {
    rows: Record<string, unknown>[];
    columns: Array<{ name: string; dataType: string }>;
    truncated: boolean;
    executionTimeMs?: number;
  };
  chartRecommendation?: {
    chartType: string;
    title?: string;
    xField?: string;
    yField?: string[];
    categoryField?: string;
    valueField?: string;
    series?: Array<{ name: string; field: string; type?: string }>;
    sort?: 'asc' | 'desc';
    limit?: number;
    stacked?: boolean;
    score?: number;
  };
  tablesUsed?: string[];
  /** LLM-generated data insight based on execution results */
  insight?: string;
  pipelineStatus?: PipelineStatus;
}

interface ChatState {
  messages: ChatMessage[];
  loading: boolean;
  conversationId: string | null;
  selectedMessageId: string | null;
  conversations: ConversationSummary[];
  conversationsLoading: boolean;
}

interface ChatActions {
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  setLoading: (loading: boolean) => void;
  clearMessages: () => void;
  setConversationId: (id: string | null) => void;
  setFeedback: (id: string, feedback: 'accepted' | 'rejected') => void;
  setGolden: (id: string, isGolden: boolean) => void;
  selectMessage: (id: string | null) => void;
  appendContent: (id: string, chunk: string) => void;
  appendInsight: (id: string, chunk: string) => void;
  setPipelineStatus: (id: string, status: PipelineStatus) => void;
  fetchConversations: (projectId: string, userId?: string) => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
}

type ChatStore = ChatState & ChatActions;

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  loading: false,
  conversationId: null,
  selectedMessageId: null,
  conversations: [],
  conversationsLoading: false,

  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),

  updateMessage: (id, updates) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),

  setLoading: (loading) => set({ loading }),

  clearMessages: () => set({ messages: [], conversationId: null, selectedMessageId: null }),

  setConversationId: (conversationId) => set({ conversationId }),

  setFeedback: (id, feedback) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, feedback } : m)),
    })),

  setGolden: (id, isGolden) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, isGolden } : m)),
    })),

  selectMessage: (selectedMessageId) => set({ selectedMessageId }),

  appendContent: (id, chunk) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, content: m.content + chunk } : m)),
    })),

  appendInsight: (id, chunk) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, insight: (m.insight ?? '') + chunk } : m,
      ),
    })),

  setPipelineStatus: (id, pipelineStatus) =>
    set((s) => ({
      messages: s.messages.map((m) => {
        if (m.id !== id) return m;
        const prevSteps = m.pipelineStatus?.steps ?? [];
        const incoming: PipelineStepEntry = {
          step: pipelineStatus.currentStep,
          message: pipelineStatus.message,
          thinking: pipelineStatus.thinking,
          data: pipelineStatus.data,
        };
        const existingIdx = prevSteps.findIndex((entry) => entry.step === incoming.step);
        const nextSteps =
          existingIdx >= 0
            ? prevSteps.map((entry, i) => (i === existingIdx ? { ...entry, ...incoming } : entry))
            : [...prevSteps, incoming];
        return {
          ...m,
          pipelineStatus: {
            ...pipelineStatus,
            steps: nextSteps,
          },
        };
      }),
    })),

  fetchConversations: async (projectId, userId?: string) => {
    set({ conversationsLoading: true });
    let url = `/api/conversations?projectId=${projectId}`;
    if (userId) url += `&userId=${userId}`;
    const res = await apiFetch<ConversationSummary[]>(url);
    set({
      conversations: res.data ?? [],
      conversationsLoading: false,
    });
  },

  loadConversation: async (conversationId) => {
    const res = await apiFetch<{
      conversation: ConversationSummary;
      messages: Array<{
        id: string;
        role: 'user' | 'assistant';
        content: string;
        generatedSql: string | null;
        executionResult: ChatMessage['executionResult'] | null;
        chartConfig: ChatMessage['chartRecommendation'] | null;
        confidence: number | null;
      }>;
    }>(`/api/conversations/${conversationId}`);

    if (!res.data) return;

    const hydrated: ChatMessage[] = res.data.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      sql: m.generatedSql ?? undefined,
      confidence: m.confidence ?? undefined,
      executionResult: m.executionResult ?? undefined,
      chartRecommendation: m.chartConfig ?? undefined,
    }));

    set({
      conversationId,
      messages: hydrated,
      selectedMessageId: null,
      loading: false,
    });
  },

  deleteConversation: async (conversationId) => {
    await apiDelete(`/api/conversations/${conversationId}`);
    const { conversationId: currentId } = get();
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== conversationId),
      ...(currentId === conversationId
        ? { conversationId: null, messages: [], selectedMessageId: null }
        : {}),
    }));
  },
}));
