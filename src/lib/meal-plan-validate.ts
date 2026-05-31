import type { MealPlanDay } from "@/types";
import { prisma } from "@/lib/prisma";

type MealInput = {
  recipeId?: string;
  type: string;
  recipeName?: string;
};

type DayInput = { date: string; meals: MealInput[] };

export function collectMealRecipeIds(days: DayInput[]): string[] {
  const ids: string[] = [];
  for (const day of days) {
    for (const meal of day.meals) {
      if (meal.recipeId) ids.push(meal.recipeId);
    }
  }
  return ids;
}

export async function enrichMealPlanDays(days: DayInput[]): Promise<MealPlanDay[]> {
  const ids = collectMealRecipeIds(days);
  const recipes = await prisma.recipe.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  const nameById = new Map(recipes.map((r) => [r.id, r.name]));

  return days.map((day) => ({
    date: day.date,
    meals: day.meals.map((meal) => ({
      type: meal.type as MealPlanDay["meals"][number]["type"],
      recipeId: meal.recipeId!,
      recipeName: nameById.get(meal.recipeId!) ?? meal.recipeName ?? "Neznámý recept",
    })),
  }));
}

export async function validateMealPlanRecipeIds(
  days: DayInput[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ids = collectMealRecipeIds(days);
  if (ids.length === 0) {
    return {
      ok: false,
      error: "Každé jídlo v plánu musí mít recipeId z databáze.",
    };
  }

  const mealCount = days.reduce((n, d) => n + d.meals.length, 0);
  if (ids.length !== mealCount) {
    return {
      ok: false,
      error: "Některá jídla nemají recipeId — použij pouze recepty z databáze.",
    };
  }

  const unique = [...new Set(ids)];
  const found = await prisma.recipe.findMany({
    where: { id: { in: unique } },
    select: { id: true },
  });

  if (found.length !== unique.length) {
    return {
      ok: false,
      error: "Plán obsahuje neplatné recipeId — znovu vyhledej recepty v databázi.",
    };
  }

  return { ok: true };
}
