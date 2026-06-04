import {
  buildRecipeNameMaps,
  resolveRecipeDisplayName,
} from "@/lib/meal-plan-enrich-names";
import { prepareMealPlanDaysForTools } from "@/lib/meal-plan-recipe-resolve";
import type { InvalidMealPlanRecipe } from "@/lib/meal-plan-recipe-resolve";
import { getRecipeCatalogIndex } from "@/lib/recipe-catalog-match";
import type { MealPlanDay } from "@/types";

type MealInput = {
  recipeId?: string;
  type: string;
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

/** Attach display names from DB; never trust model-supplied names. */
export async function enrichMealPlanDays(days: DayInput[]): Promise<MealPlanDay[]> {
  const index = await getRecipeCatalogIndex();
  const maps = buildRecipeNameMaps(
    index.recipes.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      mealTypes: r.mealTypes,
      description: "",
      ingredientNames: [],
      isFavorite: false,
    }))
  );

  return days.map((day) => ({
    date: day.date,
    meals: day.meals.map((meal) => {
      const type = meal.type as MealPlanDay["meals"][number]["type"];
      if (!meal.recipeId) {
        return { type };
      }
      const canonicalId = maps.idBySlug.get(meal.recipeId) ?? meal.recipeId;
      const recipeName =
        resolveRecipeDisplayName(meal.recipeId, maps) ?? "Neznámý recept";
      return { type, recipeId: canonicalId, recipeName };
    }),
  }));
}

/** Resolve slugs → ids, validate ids exist in DB. */
export async function validateAndResolveMealPlanDays(
  days: DayInput[],
  options?: { allowEmptySlots?: boolean }
): Promise<
  | { ok: true; days: DayInput[] }
  | {
      ok: false;
      error: string;
      invalidRecipeIds?: string[];
      invalidMeals?: InvalidMealPlanRecipe[];
    }
> {
  const resolved = await prepareMealPlanDaysForTools(days as MealPlanDay[]);
  if (!resolved.ok) {
    return {
      ok: false,
      error: resolved.error,
      invalidRecipeIds: resolved.invalidRecipeIds,
      invalidMeals: resolved.invalidMeals,
    };
  }

  const validation = await validateMealPlanRecipeIds(resolved.days, options);
  if (!validation.ok) {
    return validation;
  }

  return { ok: true, days: resolved.days };
}

export async function validateMealPlanRecipeIds(
  days: DayInput[],
  options?: { allowEmptySlots?: boolean }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ids = collectMealRecipeIds(days);
  const mealCount = days.reduce((n, d) => n + d.meals.length, 0);

  if (!options?.allowEmptySlots) {
    if (ids.length === 0) {
      return {
        ok: false,
        error: "Každé jídlo v plánu musí mít recipeId z katalogu (id nebo slug).",
      };
    }

    if (ids.length !== mealCount) {
      return {
        ok: false,
        error: "Některá jídla nemají recipeId — použij id/slug z katalogu.",
      };
    }
  } else if (ids.length > mealCount) {
    return {
      ok: false,
      error: "Neplatná data jídelního plánu.",
    };
  }

  if (ids.length === 0) {
    return { ok: true };
  }

  const unique = [...new Set(ids)];
  const { validIds } = await getRecipeCatalogIndex();

  for (const id of unique) {
    if (!validIds.has(id)) {
      return {
        ok: false,
        error: "Plán obsahuje neplatné recipeId — použij id/slug z katalogu.",
      };
    }
  }

  return { ok: true };
}
