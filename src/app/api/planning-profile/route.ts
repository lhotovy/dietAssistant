import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/user";

const schema = z.object({
  instructions: z.string().trim().max(2000),
  maxSugarsPerDay: z.number().finite().min(0).max(1000).nullable(),
  minProteinPerDay: z.number().finite().min(0).max(1000).nullable(),
});

export async function GET() {
  const userId = await getUserId();
  const profile = await prisma.userPlanningProfile.findUnique({ where: { userId } });
  return NextResponse.json(profile ?? {
    instructions: "",
    maxSugarsPerDay: null,
    minProteinPerDay: null,
  });
}

export async function PUT(req: Request) {
  const userId = await getUserId();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Neplatná plánovací pravidla." }, { status: 400 });
  }
  const profile = await prisma.userPlanningProfile.upsert({
    where: { userId },
    create: { userId, ...parsed.data },
    update: parsed.data,
  });
  return NextResponse.json(profile);
}
