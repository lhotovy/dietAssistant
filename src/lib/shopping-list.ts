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
  estimated?: boolean;
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

type CanonicalIngredient = { name: string; pieceWeightGrams?: number };

function canonicalIngredient(raw: string): CanonicalIngredient {
  const value = raw.trim().toLocaleLowerCase("cs-CZ");
  if (/^brambory(?:\s+(?:vařené|varene|velké|velke|oloupané|oloupane|nakrájené|nakrajene))*$/.test(value)) {
    return { name: "Brambory", pieceWeightGrams: value.includes("velké") || value.includes("velke") ? 250 : 180 };
  }
  if (/^batáty(?:\s+(?:velké|velke|oloupané|oloupane|nakrájené|nakrajene))*$/.test(value)) {
    return { name: "Batáty", pieceWeightGrams: 250 };
  }
  if (/^(?:čerstvá\s+)?mrkev(?:\s+(?:strouhaná|nakrájená|velká|oloupaná))*$/.test(value)) {
    return { name: "Mrkev", pieceWeightGrams: 100 };
  }
  if (/^(?:čerstvý\s+)?zázvor$/.test(value)) return { name: "Zázvor" };
  if (/^(?:jablko|jablka)$/.test(value)) return { name: "Jablka", pieceWeightGrams: 180 };
  if (/^(?:hruška|hrušky)$/.test(value)) return { name: "Hrušky", pieceWeightGrams: 180 };
  if (value === "cuketa" || value === "cukety velké") {
    return { name: "Cuketa", pieceWeightGrams: value.includes("velké") ? 400 : 250 };
  }
  if (value === "cibule") return { name: "Cibule", pieceWeightGrams: 150 };
  if (/^kuřecí pr(?:so|sa)$/.test(value)) return { name: "Kuřecí prsa" };
  if (value === "máslo na formy") return { name: "Máslo" };
  if (value === "med na podávání") return { name: "Med" };
  if (/^granola(?: \(bez ořechů\)| bez ořechů)$/.test(value)) return { name: "Granola bez ořechů" };
  if (/^petržel(?: \(kořen\)| kořen)$/.test(value)) return { name: "Petržel kořen" };
  if (/^(?:čerstvá )?petrželová nať$/.test(value)) return { name: "Petrželová nať" };
  if (/^(?:pažitka čerstvá|pažitka)$/.test(value)) return { name: "Pažitka" };
  if (/^(?:rozmarýn čerstvý|rozmarýn)$/.test(value)) return { name: "Rozmarýn" };
  if (/^(?:tymián čerstvý|tymián)$/.test(value)) return { name: "Tymián" };
  return { name: raw.trim() };
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
        const canonical = canonicalIngredient(name);
        const normalized = normalizeUnit(rawUnit);
        const estimated = normalized.unit === "ks" && canonical.pieceWeightGrams != null;
        const unit = estimated ? "g" : normalized.unit;
        const key = shoppingListItemKey(canonical.name, unit);
        const amount = ingredient.amount * normalized.multiplier * (estimated ? canonical.pieceWeightGrams! : 1) * servingsPerMeal / recipe.servings;
        const existing = items.get(key);
        if (existing) {
          existing.amount += amount;
          existing.estimated ||= estimated;
        } else {
          items.set(key, { key, name: canonical.name, amount, unit, ...(estimated ? { estimated: true } : {}) });
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
