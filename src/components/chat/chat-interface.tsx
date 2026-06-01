"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useEffect, useRef, useState, useMemo } from "react";
import { Send, Loader2, Plus, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "./chat-message";
import { cn } from "@/lib/utils";

const QUICK_PROMPTS = [
  "Připrav jídelní plán na příští týden",
  "Navrhni mi snídani z vajec a zeleniny",
  "Co uvařit k obědu z kuřecího masa?",
  "Chci snadnou večeři do 30 minut",
  "Jakou svačinu si mohu dát?",
];

interface ChatInterfaceProps {
  sessionId: string;
  initialMessages?: UIMessage[];
  showHistory?: boolean;
  onToggleHistory?: () => void;
  onNewChat?: () => void;
  onSessionsChange?: () => void;
}

export function ChatInterface({
  sessionId,
  initialMessages = [],
  showHistory = false,
  onToggleHistory,
  onNewChat,
  onSessionsChange,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { sessionId },
      }),
    [sessionId]
  );

  const { messages, sendMessage, status } = useChat({
    transport,
    messages: initialMessages,
  });

  const prevStatusRef = useRef(status);
  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleMessagesScroll = () => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 80;
  };

  useEffect(() => {
    const wasBusy =
      prevStatusRef.current === "submitted" ||
      prevStatusRef.current === "streaming";
    if (wasBusy && status === "ready" && messages.length > 0) {
      onSessionsChange?.();
    }
    prevStatusRef.current = status;
  }, [status, messages.length, onSessionsChange]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput("");
    shouldAutoScrollRef.current = true;
    await sendMessage({ text });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickPrompt = async (prompt: string) => {
    shouldAutoScrollRef.current = true;
    await sendMessage({ text: prompt });
  };

  return (
    <div className="flex flex-col h-full flex-1 min-h-0">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-stone-100 bg-white">
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-stone-900">
            Asistent pro dietu
          </h1>
          <p className="text-xs text-stone-500">Nízkohistaminové recepty</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant={showHistory ? "secondary" : "ghost"}
            size="icon"
            onClick={onToggleHistory}
            title="Historie rozhovorů"
          >
            <History className="h-5 w-5" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onNewChat}
            className="gap-1.5"
            title="Nový rozhovor"
          >
            <Plus className="h-4 w-4" />
            Nový rozhovor
          </Button>
        </div>
      </div>

      <div
        ref={messagesScrollRef}
        onScroll={handleMessagesScroll}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
            <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mb-4">
              <span className="text-3xl">🥗</span>
            </div>
            <h2 className="text-lg font-semibold text-stone-800 mb-2">
              Vítej, jsem tvůj dietní asistent
            </h2>
            <p className="text-sm text-stone-500 mb-6 max-w-xs leading-relaxed">
              Pomůžu ti s recepty pro nízkohistaminovou dietu. Řekni mi, co máš
              doma, nebo co máš chuť jíst.
            </p>
            <div className="w-full space-y-2">
              <p className="text-xs text-stone-400 font-medium uppercase tracking-wide mb-3">
                Rychlé návrhy
              </p>
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleQuickPrompt(prompt)}
                  disabled={isLoading}
                  className="w-full text-left text-sm px-4 py-3 rounded-xl bg-stone-50 text-stone-700 hover:bg-green-50 hover:text-green-800 transition-colors border border-stone-100 disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <ChatMessage
            key={`${index}-${message.id ?? message.role}`}
            message={message}
            isStreaming={
              isLoading &&
              index === messages.length - 1 &&
              message.role === "assistant"
            }
          />
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-stone-400 text-base px-1">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Přemýšlím…</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-stone-100 bg-white px-4 py-3 pb-safe">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Napiš, co máš doma nebo co chceš jíst…"
            rows={1}
            className={cn(
              "flex-1 resize-none rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-base text-stone-900 placeholder:text-stone-400",
              "focus:outline-none focus:ring-2 focus:ring-fuchsia-700 focus:border-transparent",
              "max-h-36 overflow-y-auto"
            )}
            style={{ minHeight: "46px" }}
          />
          <Button
            type="button"
            variant="accent"
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
