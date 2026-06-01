"use client";

import { useCallback, useEffect, useState } from "react";
import type { UIMessage } from "ai";
import { ChatInterface } from "./chat-interface";
import { ensureMessageIds, randomUUID } from "@/lib/client-utils";
import { cn } from "@/lib/utils";
import { useUserSessionReady } from "@/components/user-session-provider";

interface SessionSummary {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "short",
  });
}

export function ChatPageClient() {
  const userReady = useUserSessionReady();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);

  const refreshSessions = useCallback(async () => {
    const res = await fetch("/api/sessions");
    if (res.ok) {
      const data = (await res.json()) as SessionSummary[];
      setSessions(data);
    }
  }, []);

  const loadSession = useCallback(async (id: string) => {
    setLoadingSession(true);
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setActiveSessionId(data.id);
      setInitialMessages(ensureMessageIds(data.messages as UIMessage[]));
      setShowHistory(false);
    } finally {
      setLoadingSession(false);
    }
  }, []);

  const startNewChat = useCallback(() => {
    setActiveSessionId(randomUUID());
    setInitialMessages([]);
    setShowHistory(false);
  }, []);

  useEffect(() => {
    if (!userReady) return;

    async function init() {
      try {
        const res = await fetch("/api/sessions");
        if (!res.ok) {
          startNewChat();
          return;
        }
        const data = (await res.json()) as SessionSummary[];
        setSessions(data);
        if (data.length > 0) {
          await loadSession(data[0].id);
        } else {
          startNewChat();
        }
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [userReady, loadSession, startNewChat]);

  const handleSessionsChange = useCallback(() => {
    refreshSessions();
  }, [refreshSessions]);

  if (loading || !activeSessionId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-stone-400 text-sm">Načítám rozhovor…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 flex-1">
      {showHistory && (
        <div className="border-b border-stone-100 bg-white max-h-56 overflow-y-auto flex-shrink-0">
          <div className="px-4 py-2 border-b border-stone-50">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">
              Předchozí rozhovory
            </p>
          </div>
          {sessions.length === 0 ? (
            <p className="px-4 py-6 text-sm text-stone-400 text-center">
              Zatím žádné uložené rozhovory
            </p>
          ) : (
            <ul className="divide-y divide-stone-50">
              {sessions.map((session) => (
                <li key={session.id}>
                  <button
                    type="button"
                    onClick={() => loadSession(session.id)}
                    disabled={loadingSession}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-stone-50 transition-colors disabled:opacity-50",
                      session.id === activeSessionId && "bg-green-50"
                    )}
                  >
                    <p className="text-sm font-medium text-stone-800 truncate">
                      {session.title ?? "Nový rozhovor"}
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {formatSessionDate(session.updatedAt)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {loadingSession ? (
        <div className="flex items-center justify-center flex-1">
          <div className="text-stone-400 text-sm">Načítám zprávy…</div>
        </div>
      ) : (
        <ChatInterface
          key={activeSessionId}
          sessionId={activeSessionId}
          initialMessages={initialMessages}
          showHistory={showHistory}
          onToggleHistory={() => setShowHistory((v) => !v)}
          onNewChat={startNewChat}
          onSessionsChange={handleSessionsChange}
        />
      )}
    </div>
  );
}
