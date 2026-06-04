import type { UIMessage } from "ai";

export function randomUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type LegacyMessage = UIMessage & {
  content?: string | Array<{ type?: string; text?: string }>;
};

/** Older DB rows used CoreMessage `content` instead of UIMessage `parts`. */
function normalizeMessageParts(message: LegacyMessage): UIMessage["parts"] {
  if (message.parts?.length) return message.parts;

  if (typeof message.content === "string" && message.content.length > 0) {
    return [{ type: "text", text: message.content }];
  }

  if (Array.isArray(message.content)) {
    const parts: UIMessage["parts"] = [];
    for (const part of message.content) {
      if (part?.type === "text" && typeof part.text === "string") {
        parts.push({ type: "text", text: part.text });
      }
    }
    if (parts.length > 0) return parts;
  }

  return message.parts ?? [];
}

/** Ensures stable ids and UIMessage `parts` for messages loaded from the database. */
export function ensureMessageIds(messages: UIMessage[]): UIMessage[] {
  return messages.map((message, index) => {
    const id = message.id ?? `msg-${index}-${randomUUID()}`;
    const parts = normalizeMessageParts(message as LegacyMessage);
    return { ...message, id, parts };
  });
}
