import type { MealPlanDay } from "@/types";

export interface MealPlanPayload {
  title: string;
  startDate: string;
  endDate: string;
  days: MealPlanDay[];
}

function mealsHaveRecipeIds(days: unknown): days is MealPlanDay[] {
  if (!Array.isArray(days)) return false;
  return days.every(
    (day) =>
      day &&
      typeof day === "object" &&
      Array.isArray((day as MealPlanDay).meals) &&
      (day as MealPlanDay).meals.every(
        (meal) =>
          meal &&
          typeof meal.recipeId === "string" &&
          meal.recipeId.length > 0 &&
          typeof meal.recipeName === "string"
      )
  );
}

export function isMealPlanPayload(obj: unknown): obj is MealPlanPayload {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.title === "string" &&
    typeof o.startDate === "string" &&
    typeof o.endDate === "string" &&
    mealsHaveRecipeIds(o.days)
  );
}

export function extractMealPlans(text: string): MealPlanPayload[] {
  const plans: MealPlanPayload[] = [];
  for (const match of text.matchAll(/```json\s*([\s\S]*?)```/g)) {
    try {
      const parsed = JSON.parse(match[1]);
      if (isMealPlanPayload(parsed)) {
        plans.push(parsed);
      }
    } catch {
      // ignore malformed JSON
    }
  }
  return plans;
}
