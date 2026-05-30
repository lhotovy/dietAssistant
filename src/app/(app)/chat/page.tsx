import { ChatInterface } from "@/components/chat/chat-interface";

export const metadata = {
  title: "Chat — Dietní asistent",
};

export default function ChatPage() {
  return (
    <div className="flex flex-col h-full">
      <ChatInterface />
    </div>
  );
}
