import { prisma } from "@/lib/prisma";
import { isoDateInPrague } from "@/lib/date-context";
import type { UserMealPlanRecord } from "@/lib/meal-plan-conflicts";
import type { MealPlanDay } from "@/types";

export async function getUserMealPlanRecords(
  userId: string
): Promise<UserMealPlanRecord[]> {
  const plans = await prisma.mealPlan.findMany({
    where: { userId },
    orderBy: { startDate: "desc" },
  });

  return plans.map((p) => ({
    id: p.id,
    title: p.title,
    startDate: isoDateInPrague(p.startDate),
    endDate: isoDateInPrague(p.endDate),
    days: JSON.parse(p.days) as MealPlanDay[],
  }));
}
