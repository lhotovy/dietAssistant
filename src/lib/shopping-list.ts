import type { MealPlanDay, RecipeIngredient } from "@/types";

type ShoppingRecipe = {
  id: string;
  name: string;
  servings: number;
  ingredients: RecipeIngredient[];
};

export type ShoppingListItem = {
  key: string;
  name: string;
  amount: number;
  unit: string;
};

export type ShoppingListResult = {
  items: ShoppingListItem[];
  missingRecipeIds: string[];
  skippedIngredients: number;
};

const UNIT_ALIASES: Record<string, { unit: string; multiplier: number }> = {
  g: { unit: "g", multiplier: 1 },
  kg: { unit: "g", multiplier: 1000 },
  ml: { unit: "ml", multiplier: 1 },
  l: { unit: "ml", multiplier: 1000 },
  "lžičky": { unit: "lžička", multiplier: 1 },
  "lžíce": { unit: "lžíce", multiplier: 1 },
  "stroužky": { unit: "stroužek", multiplier: 1 },
  "větvičky": { unit: "větvička", multiplier: 1 },
};

function normalizeUnit(raw: string) {
  const unit = raw.trim().toLocaleLowerCase("cs-CZ");
  return UNIT_ALIASES[unit] ?? { unit, multiplier: 1 };
}

/** JSON encoding keeps the name/unit pair distinct without PostgreSQL's forbidden NUL byte. */
export function shoppingListItemKey(name: string, unit: string): string {
  return JSON.stringify([name.toLocaleLowerCase("cs-CZ"), unit]);
}

/** Accept keys from an already-open page created before the NUL separator was removed. */
export function normalizeShoppingListKey(key: string): string | null {
  if (!key.includes("\u0000")) return key;
  const parts = key.split("\u0000");
  return parts.length === 2 ? JSON.stringify(parts) : null;
}

/** Calculate ingredient needs for one serving of each planned meal. */
export function buildShoppingList(
  days: MealPlanDay[],
  recipes: ShoppingRecipe[],
  servingsPerMeal: number
): ShoppingListResult {
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const items = new Map<string, ShoppingListItem>();
  const missingRecipeIds = new Set<string>();
  let skippedIngredients = 0;

  for (const day of days) {
    for (const meal of day.meals) {
      if (!meal.recipeId) continue;
      const recipe = byId.get(meal.recipeId);
      if (!recipe || !Number.isFinite(recipe.servings) || recipe.servings <= 0) {
        missingRecipeIds.add(meal.recipeId);
        continue;
      }

      for (const ingredient of recipe.ingredients) {
        const name = ingredient.name?.trim();
        const rawUnit = ingredient.unit?.trim();
        if (!name || !rawUnit || !Number.isFinite(ingredient.amount) || ingredient.amount <= 0) {
          skippedIngredients++;
          continue;
        }
        const { unit, multiplier } = normalizeUnit(rawUnit);
        const key = shoppingListItemKey(name, unit);
        const amount = ingredient.amount * multiplier * servingsPerMeal / recipe.servings;
        const existing = items.get(key);
        if (existing) {
          existing.amount += amount;
        } else {
          items.set(key, { key, name, amount, unit });
        }
      }
    }
  }

  return {
    items: [...items.values()]
      .map((item) => ({ ...item, amount: Math.round(item.amount * 100) / 100 }))
      .sort((a, b) => a.name.localeCompare(b.name, "cs-CZ") || a.unit.localeCompare(b.unit, "cs-CZ")),
    missingRecipeIds: [...missingRecipeIds],
    skippedIngredients,
  };
}
