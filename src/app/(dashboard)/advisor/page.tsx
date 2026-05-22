"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Bot, RotateCcw, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, conversationHistory }),
        });

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
    <div className="h-screen flex flex-col">
      <div className="flex flex-1 min-h-0">
        {/* Left panel — suggested questions */}
        <aside className="hidden w-64 shrink-0 flex-col gap-3 border-r p-4 lg:flex">
          <div className="mb-1 flex items-center gap-2">
            <Sparkles className="size-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Suggested
            </span>
          </div>
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => void sendMessage(q)}
              disabled={isLoading}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left text-sm leading-snug text-muted-foreground transition-colors",
                "hover:border-foreground/20 hover:bg-muted/50 hover:text-foreground",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {q}
            </button>
          ))}

          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
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
          <div className="border-t bg-background px-4 py-3">
            <div className="mx-auto max-w-2xl">
              <div className="flex items-end gap-2 rounded-xl border bg-muted/30 px-3 py-2 focus-within:ring-1 focus-within:ring-ring">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your portfolio… (⌘+Enter to send)"
                  rows={1}
                  className="max-h-32 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
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
              <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
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
      <div className="mb-4 grid size-12 place-items-center rounded-xl bg-foreground text-background">
        <Bot className="size-6" />
      </div>
      <h1 className="mb-1 font-heading text-2xl font-semibold">Portfolio Advisor</h1>
      <p className="mb-8 text-center text-sm text-muted-foreground">
        Ask questions about your portfolio history, performance, and holdings.
      </p>
      <div className="grid w-full max-w-lg grid-cols-2 gap-2">
        {SUGGESTED_QUESTIONS.slice(0, 4).map((q) => (
          <button
            key={q}
            onClick={() => onSuggest(q)}
            className={cn(
              "rounded-lg border px-3 py-2.5 text-left text-sm leading-snug text-muted-foreground transition-colors",
              "hover:border-foreground/20 hover:bg-muted/50 hover:text-foreground",
            )}
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
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-foreground px-4 py-2 text-sm text-background">
          {message.content}
        </div>
        <div className="grid size-6 place-items-center rounded-full bg-foreground text-[10px] font-semibold text-background">
          K
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <span className="pt-1 text-xs text-muted-foreground">✦</span>
      <div className="max-w-[85%]">
        <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
          {message.isStreaming && message.content === "" ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
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
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
                Based on {message.retrievedChunks} snapshot{message.retrievedChunks !== 1 ? "s" : ""}
              </span>
            )}
            {message.provider !== undefined && (
              <span className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                message.provider === "anthropic"
                  ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
              )}>
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
