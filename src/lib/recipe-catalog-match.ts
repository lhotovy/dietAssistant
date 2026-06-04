import { prisma } from "@/lib/prisma";
import type { MealType } from "@/types";

export type CatalogRecipe = {
  id: string;
  name: string;
  slug: string;
  mealTypes: MealType[];
};

export type RecipeCatalogIndex = {
  recipes: CatalogRecipe[];
  recipeById: Map<string, CatalogRecipe>;
  validIds: Set<string>;
  idBySlug: Map<string, string>;
  nameById: Map<string, string>;
  /** Normalized display name → recipes (exact DB titles). */
  recipesByNormalizedName: Map<string, CatalogRecipe[]>;
};

let catalogIndexCache: RecipeCatalogIndex | null = null;

export function clearRecipeCatalogCache(): void {
  catalogIndexCache = null;
}

export function syncCatalogIndexCache(recipes: CatalogRecipe[]): void {
  catalogIndexCache = buildIndexFromRecipes(recipes);
}

function buildIndexFromRecipes(recipes: CatalogRecipe[]): RecipeCatalogIndex {
  const recipeById = new Map<string, CatalogRecipe>();
  const validIds = new Set<string>();
  const idBySlug = new Map<string, string>();
  const nameById = new Map<string, string>();
  const recipesByNormalizedName = new Map<string, CatalogRecipe[]>();

  for (const entry of recipes) {
    recipeById.set(entry.id, entry);
    validIds.add(entry.id);
    idBySlug.set(entry.slug, entry.id);
    nameById.set(entry.id, entry.name);

    const normName = normalizeRecipeName(entry.name);
    const bucket = recipesByNormalizedName.get(normName) ?? [];
    bucket.push(entry);
    recipesByNormalizedName.set(normName, bucket);
  }

  return {
    recipes,
    recipeById,
    validIds,
    idBySlug,
    nameById,
    recipesByNormalizedName,
  };
}

export async function getRecipeCatalogIndex(): Promise<RecipeCatalogIndex> {
  if (catalogIndexCache) return catalogIndexCache;

  const rows = await prisma.recipe.findMany({
    select: { id: true, name: true, slug: true, mealTypes: true },
    orderBy: { name: "asc" },
  });

  const recipes: CatalogRecipe[] = [];

  for (const r of rows) {
    const mealTypes = r.mealTypes
      .split(",")
      .map((s) => s.trim())
      .filter((t): t is MealType =>
        ["snidane", "obed", "vecere", "svacina", "dessert"].includes(t)
      );

    recipes.push({
      id: r.id,
      name: r.name,
      slug: r.slug,
      mealTypes,
    });
  }

  catalogIndexCache = buildIndexFromRecipes(recipes);
  return catalogIndexCache;
}

/** @deprecated Use getRecipeCatalogIndex */
export async function loadRecipeCatalog(): Promise<CatalogRecipe[]> {
  const index = await getRecipeCatalogIndex();
  return index.recipes;
}

/** Recipe id from cuid or slug (catalog line prefix). */
export function resolveRecipeIdFromIndex(
  index: RecipeCatalogIndex,
  idOrSlug: string
): string | null {
  const trimmed = idOrSlug.trim();
  if (!trimmed) return null;
  if (index.validIds.has(trimmed)) return trimmed;
  return index.idBySlug.get(trimmed) ?? null;
}

export function normalizeRecipeName(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeRecipeName(text)
    .split(" ")
    .filter((t) => t.length > 1);
}

/** 0–1 similarity; 1 = exact normalized match. */
export function scoreRecipeNameMatch(query: string, candidateName: string): number {
  const q = normalizeRecipeName(query);
  const c = normalizeRecipeName(candidateName);
  if (!q || !c) return 0;
  if (q === c) return 1;

  if (c.includes(q) || q.includes(c)) {
    const ratio = Math.min(q.length, c.length) / Math.max(q.length, c.length);
    return 0.85 + ratio * 0.1;
  }

  const qt = tokenize(query);
  const ct = tokenize(candidateName);
  if (qt.length === 0 || ct.length === 0) return 0;

  let inter = 0;
  for (const t of qt) {
    if (ct.includes(t)) inter++;
  }
  const union = new Set([...qt, ...ct]).size;
  const jaccard = inter / union;

  const prefixBonus =
    qt[0] && ct[0] && qt[0] === ct[0] && qt[1] && ct[1] && qt[1] === ct[1]
      ? 0.08
      : 0;

  return Math.min(1, jaccard + prefixBonus);
}

const MATCH_THRESHOLD = 0.72;
export const REMAP_THRESHOLD = 0.52;

export function findBestCatalogMatch(
  catalog: CatalogRecipe[],
  query: string,
  mealType: string,
  minScore: number
): { recipe: CatalogRecipe; score: number } | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const pool = catalog.filter((r) => r.mealTypes.includes(mealType as MealType));
  let best: CatalogRecipe | null = null;
  let bestScore = 0;

  for (const recipe of pool) {
    const score = scoreRecipeNameMatch(trimmed, recipe.name);
    if (score > bestScore) {
      bestScore = score;
      best = recipe;
    }
  }

  if (!best || bestScore < minScore) return null;
  return { recipe: best, score: bestScore };
}

export function matchRecipeInCatalog(
  catalog: CatalogRecipe[],
  query: string,
  mealType: string
): { recipe: CatalogRecipe; score: number } | null {
  return findBestCatalogMatch(catalog, query, mealType, MATCH_THRESHOLD);
}

export function pickCatalogRecipeForMeal(
  catalog: CatalogRecipe[],
  mealType: string,
  usedIds: Set<string>
): CatalogRecipe | null {
  const pool = catalog.filter(
    (r) => r.mealTypes.includes(mealType as MealType) && !usedIds.has(r.id)
  );
  if (pool.length > 0) return pool[0];
  return (
    catalog.find((r) => r.mealTypes.includes(mealType as MealType)) ?? null
  );
}

export function suggestRecipesForMealType(
  catalog: CatalogRecipe[],
  mealType: string,
  limit = 8
): string[] {
  return catalog
    .filter((r) => r.mealTypes.includes(mealType as MealType))
    .slice(0, limit)
    .map((r) => `${r.id} | ${r.name}`);
}
