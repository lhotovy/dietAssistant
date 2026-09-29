import { prisma } from "@/lib/prisma";
import type { MealPlanDay } from "@/types";

export type PlanConstraintCheck =
  | { ok: true }
  | { ok: false; error: string };

export async function checkPlanConstraints(
  userId: string,
  days: MealPlanDay[],
  allowEmptySlots = false
): Promise<PlanConstraintCheck> {
  const profile = await prisma.userPlanningProfile.findUnique({ where: { userId } });
  if (profile?.maxSugarsPerDay == null && profile?.minProteinPerDay == null) {
    return { ok: true };
  }

  const recipeIds = [...new Set(days.flatMap((day) => day.meals.map((meal) => meal.recipeId).filter((id): id is string => Boolean(id))))];
  const recipes = await prisma.recipe.findMany({
    where: { OR: [{ id: { in: recipeIds } }, { slug: { in: recipeIds } }] },
    select: { id: true, slug: true, name: true, sugarsPerServing: true, proteinPerServing: true },
  });
  const byId = new Map(recipes.flatMap((recipe) => [[recipe.id, recipe], [recipe.slug, recipe]] as const));

  for (const day of days) {
    let sugars = 0;
    let protein = 0;
    let hasMeals = false;
    let hasEmptySlots = false;
    for (const meal of day.meals) {
      if (!meal.recipeId) {
        hasEmptySlots = true;
        continue;
      }
      hasMeals = true;
      const recipe = byId.get(meal.recipeId);
      if (!recipe) return { ok: false, error: "Plán obsahuje neznámý recept." };
      if (profile.maxSugarsPerDay != null) {
        if (recipe.sugarsPerServing == null) {
          return { ok: false, error: `U receptu „${recipe.name}“ chybí údaj o cukrech na porci.` };
        }
        sugars += recipe.sugarsPerServing;
      }
      if (profile.minProteinPerDay != null) {
        if (recipe.proteinPerServing == null) {
          return { ok: false, error: `U receptu „${recipe.name}“ chybí údaj o bílkovinách na porci.` };
        }
        protein += recipe.proteinPerServing;
      }
    }
    if (!hasMeals && allowEmptySlots) continue;
    if (profile.maxSugarsPerDay != null && sugars > profile.maxSugarsPerDay) {
      return { ok: false, error: `${day.date}: ${formatGrams(sugars)} g cukrů překračuje denní limit ${formatGrams(profile.maxSugarsPerDay)} g.` };
    }
    if (profile.minProteinPerDay != null && protein < profile.minProteinPerDay && !(allowEmptySlots && hasEmptySlots)) {
      return { ok: false, error: `${day.date}: ${formatGrams(protein)} g bílkovin je méně než denní minimum ${formatGrams(profile.minProteinPerDay)} g.` };
    }
  }
  return { ok: true };
}

function formatGrams(value: number) {
  return Math.round(value * 10) / 10;
}
