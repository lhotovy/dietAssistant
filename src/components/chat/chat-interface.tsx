"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState, useMemo } from "react";
import { Send, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "./chat-message";
import { cn } from "@/lib/utils";
import { randomUUID } from "@/lib/client-utils";

const QUICK_PROMPTS = [
  "Navrhni mi snídani z vajec a zeleniny",
  "Co uvařit k obědu z kuřecího masa?",
  "Chci snadnou večeři do 30 minut",
  "Vytvoř mi jídelní plán na týden",
  "Jakou svačinu si mohu dát?",
];

interface ChatInterfaceProps {
  sessionId?: string;
  onSessionCreated?: (sessionId: string) => void;
}

export function ChatInterface({
  sessionId: initialSessionId,
  onSessionCreated,
}: ChatInterfaceProps) {
  const [sessionId] = useState(() => initialSessionId ?? randomUUID());
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sessionCreatedRef = useRef(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { sessionId },
      }),
    [sessionId]
  );

  const { messages, sendMessage, status, setMessages } = useChat({ transport });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (
      !sessionCreatedRef.current &&
      messages.length > 0 &&
      !initialSessionId
    ) {
      sessionCreatedRef.current = true;
      onSessionCreated?.(sessionId);
    }
  }, [messages, initialSessionId, onSessionCreated, sessionId]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput("");
    await sendMessage({ text });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickPrompt = async (prompt: string) => {
    await sendMessage({ text: prompt });
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-white">
        <div>
          <h1 className="text-base font-semibold text-stone-900">
            Asistent pro dietu
          </h1>
          <p className="text-xs text-stone-500">Nízkohistaminové recepty</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNewChat}
          title="Nový rozhovor"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
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

        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-stone-400 text-sm px-1">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Přemýšlím…</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
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
              "flex-1 resize-none rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400",
              "focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent",
              "max-h-32 overflow-y-auto"
            )}
            style={{ minHeight: "42px" }}
          />
          <Button
            type="button"
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
