import { prisma } from "@/lib/prisma";
import { detectMealPlanWeekConflict } from "@/lib/meal-plan-conflicts";
import { getUserMealPlanRecords } from "@/lib/meal-plan-user-plans";
import {
  enrichMealPlanDays,
  validateAndResolveMealPlanDays,
} from "@/lib/meal-plan-validate";
import type { MealPlanDay } from "@/types";

export type MealPlanCreateInput = {
  title: string;
  startDate: string;
  endDate: string;
  days: MealPlanDay[];
};

export type MealPlanCreateResult =
  | {
      ok: true;
      planId: string;
      title: string;
      startDate: string;
      endDate: string;
      days: MealPlanDay[];
    }
  | { ok: false; error: string };

export async function createMealPlanForUser(
  userId: string,
  input: MealPlanCreateInput
): Promise<MealPlanCreateResult> {
  const title = input.title?.trim();
  if (!title || !input.startDate || !input.endDate || !Array.isArray(input.days)) {
    return { ok: false, error: "Neplatná data jídelního plánu" };
  }

  const validation = await validateAndResolveMealPlanDays(input.days);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  const resolvedDays = validation.days;

  const existingPlans = await getUserMealPlanRecords(userId);
  const conflict = detectMealPlanWeekConflict(existingPlans, {
    startDate: input.startDate,
    endDate: input.endDate,
    days: resolvedDays as MealPlanDay[],
  });
  if (conflict) {
    return {
      ok: false,
      error:
        "Pro tento týden už existuje uložený jídelní plán. Zvol jiné období nebo upřesni datum začátku.",
    };
  }

  const enriched = await enrichMealPlanDays(resolvedDays as MealPlanDay[]);

  const plan = await prisma.mealPlan.create({
    data: {
      userId,
      title,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      days: JSON.stringify(enriched),
    },
  });

  return {
    ok: true,
    planId: plan.id,
    title: plan.title,
    startDate: input.startDate,
    endDate: input.endDate,
    days: enriched,
  };
}
