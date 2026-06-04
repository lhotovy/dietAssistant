import type { MealPlanWeekConflict } from "@/lib/meal-plan-conflicts";
import type { MealPlanDay } from "@/types";

export interface MealPlanPayload {
  title: string;
  startDate: string;
  endDate: string;
  days: MealPlanDay[];
  weekConflict?: MealPlanWeekConflict;
}

function parseWeekConflict(obj: unknown): MealPlanWeekConflict | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const c = obj as Record<string, unknown>;
  if (
    typeof c.conflictingWeekStart === "string" &&
    typeof c.conflictingWeekEnd === "string" &&
    typeof c.existingPlanId === "string" &&
    typeof c.existingPlanTitle === "string" &&
    typeof c.suggestedNextWeekStart === "string" &&
    typeof c.suggestedNextWeekEnd === "string"
  ) {
    return {
      conflictingWeekStart: c.conflictingWeekStart,
      conflictingWeekEnd: c.conflictingWeekEnd,
      existingPlanId: c.existingPlanId,
      existingPlanTitle: c.existingPlanTitle,
      suggestedNextWeekStart: c.suggestedNextWeekStart,
      suggestedNextWeekEnd: c.suggestedNextWeekEnd,
    };
  }
  return undefined;
}

function normalizeMealType(
  type: unknown
): MealPlanDay["meals"][number]["type"] | null {
  if (typeof type !== "string") return null;
  const map: Record<string, MealPlanDay["meals"][number]["type"]> = {
    snidane: "snidane",
    snídaně: "snidane",
    breakfast: "snidane",
    obed: "obed",
    oběd: "obed",
    lunch: "obed",
    vecere: "vecere",
    večeře: "vecere",
    dinner: "vecere",
    svacina: "svacina",
    svačina: "svacina",
    snack: "svacina",
    dessert: "dessert",
    dezert: "dessert",
  };
  return map[type.toLowerCase()] ?? null;
}

function normalizeDays(days: unknown): MealPlanDay[] | null {
  if (!Array.isArray(days) || days.length === 0) return null;

  const normalized: MealPlanDay[] = [];
  for (const day of days) {
    if (!day || typeof day !== "object") return null;
    const d = day as { date?: unknown; meals?: unknown };
    if (typeof d.date !== "string" || !Array.isArray(d.meals)) return null;

    const meals: MealPlanDay["meals"] = [];
    for (const meal of d.meals) {
      if (!meal || typeof meal !== "object") return null;
      const m = meal as {
        type?: unknown;
        recipeId?: unknown;
        recipeName?: unknown;
      };
      const type = normalizeMealType(m.type);
      if (!type) return null;
      if (typeof m.recipeId !== "string" || m.recipeId.length === 0) return null;
      const recipeName =
        typeof m.recipeName === "string" && m.recipeName.trim().length > 0
          ? m.recipeName.trim()
          : undefined;
      meals.push({
        type,
        recipeId: m.recipeId,
        ...(recipeName ? { recipeName } : {}),
      });
    }
    if (meals.length === 0) return null;
    normalized.push({ date: d.date, meals });
  }

  return normalized;
}

/** Accepts tool output/input and JSON blocks; fills missing recipeName. */
export function normalizeMealPlanPayload(obj: unknown): MealPlanPayload | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;

  if (o.success === false) return null;

  const title = typeof o.title === "string" ? o.title : null;
  const startDate = typeof o.startDate === "string" ? o.startDate : null;
  const endDate = typeof o.endDate === "string" ? o.endDate : null;
  const days = normalizeDays(o.days);

  if (!title || !startDate || !endDate || !days) return null;

  const weekConflict = parseWeekConflict(o.weekConflict);

  return { title, startDate, endDate, days, weekConflict };
}

export function isMealPlanPayload(obj: unknown): obj is MealPlanPayload {
  return normalizeMealPlanPayload(obj) !== null;
}

export function extractMealPlans(text: string): MealPlanPayload[] {
  const plans: MealPlanPayload[] = [];
  for (const match of text.matchAll(/```json\s*([\s\S]*?)```/g)) {
    try {
      const parsed = JSON.parse(match[1]);
      const plan = normalizeMealPlanPayload(parsed);
      if (plan) plans.push(plan);
    } catch {
      // ignore malformed JSON
    }
  }
  return plans;
}
