import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/user";
import type { MealPlanDay } from "@/types";
import { validateMealPlanRecipeIds } from "@/lib/meal-plan-validate";

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

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  const body = await req.json();
  const { title, startDate, endDate, days } = body as {
    title?: string;
    startDate?: string;
    endDate?: string;
    days?: MealPlanDay[];
  };

  if (!title?.trim() || !startDate || !endDate || !Array.isArray(days)) {
    return NextResponse.json(
      { error: "Neplatná data jídelního plánu" },
      { status: 400 }
    );
  }

  const validation = await validateMealPlanRecipeIds(days);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const plan = await prisma.mealPlan.create({
    data: {
      userId,
      title: title.trim(),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      days: JSON.stringify(days),
    },
  });

  return NextResponse.json({
    id: plan.id,
    title: plan.title,
    startDate: plan.startDate,
    endDate: plan.endDate,
    days: JSON.parse(plan.days) as MealPlanDay[],
    createdAt: plan.createdAt,
  });
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  const { id } = await req.json();
  await prisma.mealPlan.deleteMany({ where: { id, userId } });
  return NextResponse.json({ success: true });
}
