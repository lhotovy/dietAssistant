import type { UIMessage } from "ai";
import { prisma } from "@/lib/prisma";

export async function persistChatSession(
  sessionId: string,
  userId: string,
  allMessages: UIMessage[]
): Promise<void> {
  const existing = await prisma.chatSession.findUnique({
    where: { id: sessionId },
  });

  if (existing) {
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        messages: JSON.stringify(allMessages),
        updatedAt: new Date(),
      },
    });
    return;
  }

  const firstUserMsg = allMessages.find((m) => m.role === "user");
  const textPart = firstUserMsg?.parts?.find(
    (p): p is { type: "text"; text: string } =>
      typeof p === "object" &&
      p !== null &&
      "type" in p &&
      p.type === "text" &&
      "text" in p
  );
  const title = textPart?.text?.slice(0, 60) ?? "Nový rozhovor";

  await prisma.chatSession.create({
    data: {
      id: sessionId,
      userId,
      title,
      messages: JSON.stringify(allMessages),
    },
  });
}
