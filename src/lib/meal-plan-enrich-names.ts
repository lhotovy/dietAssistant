import type { MealPlanPayload } from "@/lib/meal-plan-parse";
import type { PlanningRecipe } from "@/types";

export type RecipeNameMaps = {
  nameById: Map<string, string>;
  idBySlug: Map<string, string>;
};

export function buildRecipeNameMaps(
  recipes: PlanningRecipe[]
): RecipeNameMaps {
  const nameById = new Map<string, string>();
  const idBySlug = new Map<string, string>();
  for (const r of recipes) {
    nameById.set(r.id, r.name);
    idBySlug.set(r.slug, r.id);
  }
  return { nameById, idBySlug };
}

export function resolveRecipeDisplayName(
  recipeId: string,
  maps: RecipeNameMaps
): string | undefined {
  const trimmed = recipeId.trim();
  if (!trimmed) return undefined;
  const byId = maps.nameById.get(trimmed);
  if (byId) return byId;
  const canonicalId = maps.idBySlug.get(trimmed);
  if (canonicalId) return maps.nameById.get(canonicalId);
  return undefined;
}

/** Fill missing or placeholder meal names from catalog (client or server). */
export function enrichMealPlanPayloadNames(
  plan: MealPlanPayload,
  maps: RecipeNameMaps
): MealPlanPayload {
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      meals: day.meals.map((meal) => {
        if (!meal.recipeId) return meal;
        const resolved = resolveRecipeDisplayName(meal.recipeId, maps);
        const current = meal.recipeName?.trim();
        const placeholder =
          !current || current === "Recept" || current === "Neznámý recept";
        return {
          ...meal,
          recipeId: maps.idBySlug.get(meal.recipeId) ?? meal.recipeId,
          recipeName: placeholder
            ? (resolved ?? current ?? "Neznámý recept")
            : current,
        };
      }),
    })),
  };
}
