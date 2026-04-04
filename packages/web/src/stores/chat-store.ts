import { create } from 'zustand';

/** Pipeline step identifier — extensible, backend may send any step name */
export type PipelineStep = string;

export interface PipelineStepEntry {
  step: string;
  message: string;
}

export interface PipelineStatus {
  currentStep: string;
  message: string;
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
    config: unknown;
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
}

type ChatStore = ChatState & ChatActions;

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  loading: false,
  conversationId: null,
  selectedMessageId: null,

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
        return {
          ...m,
          pipelineStatus: {
            ...pipelineStatus,
            steps: [
              ...prevSteps,
              { step: pipelineStatus.currentStep, message: pipelineStatus.message },
            ],
          },
        };
      }),
    })),
}));
