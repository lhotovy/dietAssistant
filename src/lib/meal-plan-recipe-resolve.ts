import {
  getRecipeCatalogIndex,
  resolveRecipeIdFromIndex,
  suggestRecipesForMealType,
  type CatalogRecipe,
  type RecipeCatalogIndex,
} from "@/lib/recipe-catalog-match";
import type { MealPlanDay, MealType } from "@/types";

type MealInput = {
  recipeId?: string;
  type: string;
};

type DayInput = { date: string; meals: MealInput[] };

export type InvalidMealPlanRecipe = {
  date: string;
  mealType: string;
  attempted: string;
  suggestions: string[];
};

export type MealPlanRecipeResolveResult =
  | { ok: true; days: DayInput[] }
  | {
      ok: false;
      error: string;
      invalidRecipeIds: string[];
      invalidMeals: InvalidMealPlanRecipe[];
    };

function getRecipeById(
  index: RecipeCatalogIndex,
  id: string
): CatalogRecipe | undefined {
  return index.recipeById.get(id);
}

function resolveMealRecipe(
  meal: MealInput,
  index: RecipeCatalogIndex,
  date: string
): { ok: true; meal: MealInput } | { ok: false; invalid: InvalidMealPlanRecipe } {
  const attempted = meal.recipeId?.trim() ?? "";
  const mealType = meal.type as MealType;
  if (!attempted) {
    return {
      ok: false,
      invalid: {
        date,
        mealType: meal.type,
        attempted: "(chybí recipeId)",
        suggestions: suggestRecipesForMealType(index.recipes, meal.type),
      },
    };
  }

  const canonicalId = resolveRecipeIdFromIndex(index, attempted);
  if (!canonicalId) {
    return {
      ok: false,
      invalid: {
        date,
        mealType: meal.type,
        attempted,
        suggestions: suggestRecipesForMealType(index.recipes, meal.type),
      },
    };
  }

  const recipe = getRecipeById(index, canonicalId);
  if (!recipe) {
    return {
      ok: false,
      invalid: {
        date,
        mealType: meal.type,
        attempted,
        suggestions: suggestRecipesForMealType(index.recipes, meal.type),
      },
    };
  }

  if (!recipe.mealTypes.includes(mealType)) {
    return {
      ok: false,
      invalid: {
        date,
        mealType: meal.type,
        attempted: `${attempted} (${recipe.name} není typ ${meal.type})`,
        suggestions: suggestRecipesForMealType(index.recipes, meal.type),
      },
    };
  }

  return {
    ok: true,
    meal: { type: meal.type, recipeId: canonicalId },
  };
}

/** Map slug, id, or exact DB name → canonical recipeId. */
export async function resolveMealPlanDaysRecipeIds(
  days: DayInput[]
): Promise<MealPlanRecipeResolveResult> {
  const index = await getRecipeCatalogIndex();
  const invalidMeals: InvalidMealPlanRecipe[] = [];
  const invalidIdSet = new Set<string>();
  const resolvedDays: DayInput[] = [];

  for (const day of days) {
    const resolvedMeals: MealInput[] = [];

    for (const meal of day.meals) {
      const result = resolveMealRecipe(meal, index, day.date);
      if (result.ok) {
        resolvedMeals.push(result.meal);
      } else {
        invalidMeals.push(result.invalid);
        if (meal.recipeId) invalidIdSet.add(meal.recipeId);
        resolvedMeals.push(meal);
      }
    }

    resolvedDays.push({ date: day.date, meals: resolvedMeals });
  }

  if (invalidMeals.length > 0) {
    return {
      ok: false,
      error:
        "Některá jídla nejdou přiřadit k receptu v databázi. V nástroji použij recipeId (cuid) z začátku řádku katalogu.",
      invalidRecipeIds: [...invalidIdSet],
      invalidMeals,
    };
  }

  return { ok: true, days: resolvedDays };
}

export async function prepareMealPlanDaysForTools(
  days: MealPlanDay[]
): Promise<MealPlanRecipeResolveResult> {
  return resolveMealPlanDaysRecipeIds(days);
}
