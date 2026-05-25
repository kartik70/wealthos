"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Bot, RotateCcw, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { Button } from "@/components/ui/button";
import {
  ApiKeyPrompt,
  parseMissingApiKeyPayload,
  type MissingApiKey,
} from "@/components/ui/ApiKeyPrompt";
import { withAIProviderHeaders } from "@/lib/ai/provider";
import { useAdvisorStore, type ChatMessage } from "@/stores/advisorStore";

const SUGGESTED_QUESTIONS = [
  "Why is my portfolio down?",
  "Which positions should I exit?",
  "How has my portfolio changed this month?",
  "What are my tax harvesting opportunities?",
  "Which stocks have the highest concentration risk?",
  "What's my overall gain/loss trend this year?",
];

export default function AdvisorPage() {
  const { messages, setMessages, addMessage, updateLastAssistantMessage, finalizeLastAssistantMessage, clearMessages } =
    useAdvisorStore();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [missingApiKey, setMissingApiKey] = useState<MissingApiKey | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    let isMounted = true;

    async function loadHistory() {
      try {
        const response = await fetch("/api/advisor/history", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          messages?: Array<{
            id: string;
            role: "user" | "assistant";
            content: string;
            created_at: string;
          }>;
        };

        if (!isMounted || payload.messages === undefined) {
          return;
        }

        const sortedMessages = [...payload.messages].sort((a, b) => {
          const timeDelta =
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime();

          if (timeDelta !== 0) {
            return timeDelta;
          }

          if (a.role !== b.role) {
            return a.role === "user" ? -1 : 1;
          }

          return a.id.localeCompare(b.id);
        });

        setMessages(sortedMessages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          isStreaming: false,
        })));
      } catch {
        // No-op: chat still works without history hydration.
      }
    }

    void loadHistory();

    return () => {
      isMounted = false;
    };
  }, [setMessages]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (trimmed === "" || isLoading) return;

      setInput("");
      setIsLoading(true);

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
      };
      addMessage(userMessage);

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        isStreaming: true,
      };
      addMessage(assistantMessage);

      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const response = await fetch("/api/advisor/chat", {
          method: "POST",
          headers: withAIProviderHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ message: trimmed, conversationHistory }),
        });

        if (response.status === 402) {
          const payload: unknown = await response.json().catch(() => null);
          const missing = parseMissingApiKeyPayload(payload);
          if (missing !== null) {
            setMissingApiKey(missing);
            updateLastAssistantMessage("");
            finalizeLastAssistantMessage(0, "anthropic");
            return;
          }
        }

        if (!response.ok || response.body === null) {
          throw new Error("Failed to connect to advisor");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let meta = { retrievedChunks: 0, provider: "anthropic" as "anthropic" | "gemini" };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data.trim() === "") continue;

            try {
              const parsed = JSON.parse(data) as {
                type: string;
                text?: string;
                retrievedChunks?: number;
                provider?: "anthropic" | "gemini";
                error?: string;
              };

              if (parsed.type === "meta") {
                meta = {
                  retrievedChunks: parsed.retrievedChunks ?? 0,
                  provider: parsed.provider ?? "anthropic",
                };
              } else if (parsed.type === "delta" && parsed.text) {
                fullText += parsed.text;
                updateLastAssistantMessage(fullText);
              } else if (parsed.type === "error") {
                fullText = `Error: ${parsed.error ?? "Something went wrong"}`;
                updateLastAssistantMessage(fullText);
              }
            } catch {
              // ignore malformed SSE lines
            }
          }
        }

        finalizeLastAssistantMessage(meta.retrievedChunks, meta.provider);
      } catch (err) {
        const errorText = err instanceof Error ? err.message : "Failed to send message";
        updateLastAssistantMessage(errorText);
        finalizeLastAssistantMessage(0, "anthropic");
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, addMessage, updateLastAssistantMessage, finalizeLastAssistantMessage],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="h-screen flex flex-col" style={{ background: "#0a0f1e" }}>
      <div className="flex flex-1 min-h-0">
        {/* Left panel — suggested questions */}
        <aside
          className="hidden w-72 shrink-0 flex-col gap-3 p-5 lg:flex"
          style={{ background: "#0a0f1e", borderRight: "1px solid #1e2d40" }}
        >
          <div className="mb-1 flex items-center gap-2">
            <Sparkles className="size-3.5" style={{ color: "#3b82f6" }} />
            <span
              className="text-[10px] font-medium uppercase tracking-[0.18em]"
              style={{ color: "#4a5568" }}
            >
              Suggested
            </span>
          </div>
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => void sendMessage(q)}
              disabled={isLoading}
              className="rounded-lg px-4 py-3 text-left text-sm leading-snug transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: "#111827",
                border: "1px solid #1e2d40",
                color: "#8899aa",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#ffffff";
                e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#8899aa";
                e.currentTarget.style.borderColor = "#1e2d40";
              }}
            >
              {q}
            </button>
          ))}

          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="mt-auto flex items-center gap-1.5 text-xs transition-colors"
              style={{ color: "#4a5568" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#4a5568")}
            >
              <RotateCcw className="size-3" />
              Clear conversation
            </button>
          )}
        </aside>

        {/* Main chat area */}
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            {missingApiKey !== null && (
              <div className="mx-auto max-w-2xl px-4 pt-4">
                <ApiKeyPrompt
                  missingKey={missingApiKey}
                  onDismiss={() => setMissingApiKey(null)}
                />
              </div>
            )}
            {isEmpty ? (
              <EmptyState onSuggest={(q) => void sendMessage(q)} />
            ) : (
              <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div
            className="px-4 py-4"
            style={{ background: "#0a0f1e", borderTop: "1px solid #1e2d40" }}
          >
            <div className="mx-auto max-w-2xl">
              <div
                className="flex items-end gap-2 rounded-xl px-3 py-2 focus-within:ring-1"
                style={{
                  background: "#111827",
                  border: "1px solid #1e2d40",
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your portfolio… (⌘+Enter to send)"
                  rows={1}
                  className="max-h-32 flex-1 resize-none bg-transparent text-sm text-white outline-none placeholder:text-[#4a5568]"
                  style={{ scrollbarWidth: "none" }}
                />
                <Button
                  size="icon"
                  className="size-7 shrink-0"
                  disabled={input.trim() === "" || isLoading}
                  onClick={() => void sendMessage(input)}
                >
                  <ArrowUp className="size-3.5" />
                </Button>
              </div>
              <p className="mt-2 text-center text-[11px]" style={{ color: "#4a5568" }}>
                WealthOS advisor uses your portfolio history. Not financial advice.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onSuggest }: { onSuggest: (q: string) => void }) {
  return (
    <div className="flex h-full min-h-full flex-col items-center justify-center px-4 pb-12 pt-16">
      <div
        className="mb-4 grid size-12 place-items-center rounded-xl"
        style={{ background: "rgba(59, 130, 246, 0.12)", color: "#3b82f6" }}
      >
        <Bot className="size-6" />
      </div>
      <h1
        className="mb-1 text-2xl tracking-tight text-white"
        style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
      >
        Portfolio Advisor
      </h1>
      <p className="mb-8 text-center text-sm" style={{ color: "#8899aa" }}>
        Ask questions about your portfolio history, performance, and holdings.
      </p>
      <div className="grid w-full max-w-lg grid-cols-2 gap-2">
        {SUGGESTED_QUESTIONS.slice(0, 4).map((q) => (
          <button
            key={q}
            onClick={() => onSuggest(q)}
            className="rounded-lg px-4 py-3 text-left text-sm leading-snug transition-colors"
            style={{
              background: "#111827",
              border: "1px solid #1e2d40",
              color: "#8899aa",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#ffffff";
              e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#8899aa";
              e.currentTarget.style.borderColor = "#1e2d40";
            }}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex items-end justify-end gap-2">
        <div
          className="max-w-[80%] rounded-2xl rounded-br-sm px-4 py-2 text-sm text-white"
          style={{ background: "#1a2235", border: "1px solid #1e2d40" }}
        >
          {message.content}
        </div>
        <div
          className="grid size-6 place-items-center rounded-full font-mono text-[10px]"
          style={{ background: "#1a2235", color: "#3b82f6", fontWeight: 500 }}
        >
          K
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <span className="pt-1 text-sm" style={{ color: "#3b82f6" }}>✦</span>
      <div className="max-w-[85%]">
        <div
          className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed"
          style={{ color: "#d1d9e0" }}
        >
          {message.isStreaming && message.content === "" ? (
            <span className="inline-flex items-center gap-1" style={{ color: "#8899aa" }}>
              <span className="animate-pulse">Thinking</span>
              <span className="inline-flex gap-0.5">
                <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
              </span>
            </span>
          ) : (
            <MessageContent content={message.content} isStreaming={message.isStreaming} />
          )}
        </div>

        {!message.isStreaming && (message.retrievedChunks !== undefined || message.provider !== undefined) && (
          <div className="mt-2 flex items-center gap-2">
            {message.retrievedChunks !== undefined && message.retrievedChunks > 0 && (
              <span
                className="rounded px-2 py-0.5 font-mono text-[10px]"
                style={{
                  background: "#111827",
                  border: "1px solid #1e2d40",
                  color: "#4a5568",
                }}
              >
                {message.retrievedChunks} snapshot{message.retrievedChunks !== 1 ? "s" : ""}
              </span>
            )}
            {message.provider !== undefined && (
              <span
                className="rounded px-2 py-0.5 font-mono text-[10px]"
                style={{
                  background: "#111827",
                  border: "1px solid #1e2d40",
                  color: "#4a5568",
                }}
              >
                {message.provider === "anthropic" ? "Claude" : "Gemini"}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageContent({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  if (isStreaming) {
    return (
      <div className="whitespace-pre-wrap">
        {content}
        <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
