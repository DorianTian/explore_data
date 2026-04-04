import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  confidence?: number;
  feedback?: 'up' | 'down';
  isStreaming?: boolean;
  executionResult?: {
    rows: Record<string, unknown>[];
    columns: Array<{ name: string; dataType: string }>;
    truncated: boolean;
  };
  chartRecommendation?: {
    chartType: string;
    config: unknown;
  };
}

interface ChatState {
  messages: ChatMessage[];
  loading: boolean;
  conversationId: string | null;
}

interface ChatActions {
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  setLoading: (loading: boolean) => void;
  clearMessages: () => void;
  setFeedback: (id: string, feedback: 'up' | 'down') => void;
  setConversationId: (id: string | null) => void;
}

type ChatStore = ChatState & ChatActions;

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  loading: false,
  conversationId: null,

  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),

  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),

  setLoading: (loading) => set({ loading }),

  clearMessages: () => set({ messages: [] }),

  setFeedback: (id, feedback) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, feedback } : m)),
    })),

  setConversationId: (id) => set({ conversationId: id }),
}));
