import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/user";

export async function GET() {
  const userId = await getUserId();
  const sessions = await prisma.chatSession.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json(sessions);
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  const { id } = await req.json();
  await prisma.chatSession.deleteMany({ where: { id, userId } });
  return NextResponse.json({ success: true });
}
