import { formatPlanningCatalogContext } from "@/lib/planning-catalog";
import type { CatalogRecipe } from "@/lib/recipe-catalog-match";
import { getRecipeCatalogIndex } from "@/lib/recipe-catalog-match";
import type { PlanningRecipe } from "@/types";

function catalogToPlanning(recipes: CatalogRecipe[]): PlanningRecipe[] {
  return recipes.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    mealTypes: r.mealTypes,
    description: "",
    ingredientNames: [],
    isFavorite: false,
  }));
}

/** @deprecated Prefer resolvePlanningCatalogContext */
export function formatRecipeCatalogContext(recipes: CatalogRecipe[]): string {
  return formatPlanningCatalogContext(catalogToPlanning(recipes));
}

export async function buildRecipeCatalogContext(): Promise<string> {
  const { recipes } = await getRecipeCatalogIndex();
  return formatRecipeCatalogContext(recipes);
}
