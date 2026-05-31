import { ChatPageClient } from "@/components/chat/chat-page-client";

export const metadata = {
  title: "Chat — Dietní asistent",
};

export default function ChatPage() {
  return (
    <div className="flex flex-col h-full min-h-0">
      <ChatPageClient />
    </div>
  );
}
