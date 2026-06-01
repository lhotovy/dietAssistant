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

/** Ensures every message has a stable id (older saved sessions may omit them). */
export function ensureMessageIds(messages: UIMessage[]): UIMessage[] {
  return messages.map((message, index) =>
    message.id ? message : { ...message, id: `msg-${index}-${randomUUID()}` }
  );
}
