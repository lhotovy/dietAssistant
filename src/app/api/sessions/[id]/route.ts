import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/user";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();
  const { id } = await params;
  const session = await prisma.chatSession.findFirst({
    where: { id, userId },
  });
  if (!session)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    id: session.id,
    title: session.title,
    messages: JSON.parse(session.messages),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  });
}
