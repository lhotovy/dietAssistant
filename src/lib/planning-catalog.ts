import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  syncCatalogIndexCache,
  type CatalogRecipe,
} from "@/lib/recipe-catalog-match";
import type { MealType, PlanningRecipe } from "@/types";

export type { PlanningRecipe };

const MEAL_TYPES: MealType[] = [
  "snidane",
  "obed",
  "vecere",
  "svacina",
  "dessert",
];

const MEAL_TYPE_HEADINGS: Record<MealType, string> = {
  snidane: "Snídaně",
  obed: "Oběd",
  vecere: "Večeře",
  svacina: "Svačina",
  dessert: "Dezert",
};

const DESC_MAX = 120;

export type PlanningCatalogPayload = {
  version: string;
  recipes: PlanningRecipe[];
  contextText: string;
  fetchedAt: string;
};

type CachedCatalog = PlanningCatalogPayload;

let latestCatalog: CachedCatalog | null = null;
const catalogByVersion = new Map<string, CachedCatalog>();

function parseMealTypes(raw: string): MealType[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((t): t is MealType =>
      ["snidane", "obed", "vecere", "svacina", "dessert"].includes(t)
    );
}

function parseIngredientNames(json: string): string[] {
  try {
    const parsed = JSON.parse(json) as Array<{ name?: string }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((i) => (typeof i.name === "string" ? i.name.trim() : ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function truncateDescription(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= DESC_MAX) return t;
  return `${t.slice(0, DESC_MAX - 1)}…`;
}

function formatRecipeLine(r: PlanningRecipe): string {
  const fav = r.isFavorite ? " ★" : "";
  const ing =
    r.ingredientNames.length > 0
      ? r.ingredientNames.slice(0, 12).join(", ")
      : "—";
  const desc = r.description || "—";
  return `${r.id} | ${r.name}${fav} | ingr: ${ing} | ${desc}`;
}

export function formatPlanningCatalogContext(recipes: PlanningRecipe[]): string {
  const byType = new Map<MealType, string[]>();
  for (const t of MEAL_TYPES) byType.set(t, []);

  for (const recipe of recipes) {
    const line = formatRecipeLine(recipe);
    for (const t of recipe.mealTypes) {
      byType.get(t)!.push(line);
    }
  }

  const sections = MEAL_TYPES.map((t) => {
    const lines = byType.get(t) ?? [];
    return `### ${MEAL_TYPE_HEADINGS[t]} (${lines.length})\n${lines.join("\n") || "(žádné)"}`;
  });

  return `## KATALOG RECEPTŮ (jediný zdroj pro jídelní plány)
- Každý řádek začíná **recipeId** (cuid) — do prepareMealPlan/saveMealPlan posílej výhradně toto id.
- Název v řádku je jen pro čtení; ★ = oblíbené uživatelky. Nevymýšlej id ani jídla.
- Jídelní plán = sestavení sad recipeId podle kritérií (rozmanitost, dieta, oblíbené).
- Názvy pro uživatelku doplní aplikace z DB po nástroji — neposílej recipeName.

${sections.join("\n\n")}`;
}

export async function buildPlanningCatalog(
  userId: string
): Promise<PlanningCatalogPayload> {
  const [rows, favorites] = await Promise.all([
    prisma.recipe.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        mealTypes: true,
        description: true,
        ingredients: true,
        updatedAt: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.favorite.findMany({
      where: { userId, recipeId: { not: null } },
      select: { recipeId: true },
    }),
  ]);

  const favoriteIds = new Set(
    favorites.map((f) => f.recipeId).filter((id): id is string => Boolean(id))
  );

  const recipes: PlanningRecipe[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    mealTypes: parseMealTypes(r.mealTypes),
    description: truncateDescription(r.description),
    ingredientNames: parseIngredientNames(r.ingredients),
    isFavorite: favoriteIds.has(r.id),
  }));

  const maxUpdatedAt = rows.reduce(
    (max, r) => (r.updatedAt > max ? r.updatedAt : max),
    rows[0]?.updatedAt ?? new Date(0)
  );

  const version = createHash("sha256")
    .update(
      [
        recipes.length,
        maxUpdatedAt.toISOString(),
        [...favoriteIds].sort().join(","),
      ].join("|")
    )
    .digest("hex")
    .slice(0, 16);

  const contextText = formatPlanningCatalogContext(recipes);
  const fetchedAt = new Date().toISOString();

  return { version, recipes, contextText, fetchedAt };
}

export function cachePlanningCatalog(payload: PlanningCatalogPayload): void {
  latestCatalog = payload;
  catalogByVersion.set(payload.version, payload);
}

export function clearPlanningCatalogCache(): void {
  latestCatalog = null;
  catalogByVersion.clear();
}

export function latestPlanningCatalogRecipes(): CatalogRecipe[] | null {
  if (!latestCatalog) return null;
  return toCatalogRecipes(latestCatalog.recipes);
}

export async function getPlanningCatalogForUser(
  userId: string
): Promise<PlanningCatalogPayload> {
  const built = await buildPlanningCatalog(userId);
  cachePlanningCatalog(built);
  syncCatalogIndexCache(toCatalogRecipes(built.recipes));
  return built;
}

export async function resolvePlanningCatalogContext(
  userId: string,
  catalogVersion?: string
): Promise<{ contextText: string; version: string }> {
  if (
    catalogVersion &&
    catalogByVersion.has(catalogVersion)
  ) {
    const cached = catalogByVersion.get(catalogVersion)!;
    return { contextText: cached.contextText, version: cached.version };
  }

  if (catalogVersion && latestCatalog?.version === catalogVersion) {
    return {
      contextText: latestCatalog.contextText,
      version: latestCatalog.version,
    };
  }

  const built = await getPlanningCatalogForUser(userId);
  return { contextText: built.contextText, version: built.version };
}

/** Map planning recipes to catalog index entries for validation. */
export function toCatalogRecipes(recipes: PlanningRecipe[]): CatalogRecipe[] {
  return recipes.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    mealTypes: r.mealTypes,
  }));
}
