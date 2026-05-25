import { create } from "zustand";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  retrievedChunks?: number;
  retrievedChunkTypes?: string[];
  provider?: "anthropic" | "gemini";
  usedMarketNews?: boolean;
  isStreaming?: boolean;
}

interface AdvisorStore {
  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  updateLastAssistantMessage: (text: string) => void;
  finalizeLastAssistantMessage: (
    retrievedChunks: number,
    provider: "anthropic" | "gemini",
    usedMarketNews?: boolean,
    retrievedChunkTypes?: string[],
  ) => void;
  clearMessages: () => void;
}

export const useAdvisorStore = create<AdvisorStore>((set) => ({
  messages: [],

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  updateLastAssistantMessage: (text) =>
    set((state) => {
      const messages = [...state.messages];
      const lastIdx = messages.length - 1;
      if (lastIdx >= 0 && messages[lastIdx].role === "assistant") {
        messages[lastIdx] = { ...messages[lastIdx], content: text };
      }
      return { messages };
    }),

  finalizeLastAssistantMessage: (
    retrievedChunks,
    provider,
    usedMarketNews,
    retrievedChunkTypes,
  ) =>
    set((state) => {
      const messages = [...state.messages];
      const lastIdx = messages.length - 1;
      if (lastIdx >= 0 && messages[lastIdx].role === "assistant") {
        messages[lastIdx] = {
          ...messages[lastIdx],
          isStreaming: false,
          retrievedChunks,
          retrievedChunkTypes: retrievedChunkTypes ?? [],
          provider,
          usedMarketNews: usedMarketNews ?? false,
        };
      }
      return { messages };
    }),

  clearMessages: () => set({ messages: [] }),
}));
