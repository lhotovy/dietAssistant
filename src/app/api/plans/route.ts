import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/user";
import type { MealPlanDay } from "@/types";

export async function GET() {
  const userId = await getUserId();
  const plans = await prisma.mealPlan.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    plans.map((p) => ({
      id: p.id,
      title: p.title,
      startDate: p.startDate,
      endDate: p.endDate,
      days: JSON.parse(p.days) as MealPlanDay[],
      createdAt: p.createdAt,
    }))
  );
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  const { id } = await req.json();
  await prisma.mealPlan.deleteMany({ where: { id, userId } });
  return NextResponse.json({ success: true });
}
