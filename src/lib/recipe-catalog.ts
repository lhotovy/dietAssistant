import { prisma } from "@/lib/prisma";
import type { MealType } from "@/types";

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

export async function buildRecipeCatalogContext(): Promise<string> {
  const recipes = await prisma.recipe.findMany({
    select: { id: true, name: true, mealTypes: true },
    orderBy: { name: "asc" },
  });

  const byType = new Map<MealType, string[]>();
  for (const t of MEAL_TYPES) byType.set(t, []);

  for (const recipe of recipes) {
    const types = recipe.mealTypes.split(",").map((s) => s.trim());
    const line = `${recipe.id} — ${recipe.name}`;
    for (const t of types) {
      if (MEAL_TYPES.includes(t as MealType)) {
        byType.get(t as MealType)!.push(line);
      }
    }
  }

  const sections = MEAL_TYPES.map((t) => {
    const lines = byType.get(t) ?? [];
    return `### ${MEAL_TYPE_HEADINGS[t]} (${lines.length} receptů)\nFormát: recipeId — název\n${lines.join("\n") || "(žádné)"}`;
  });

  return `## KATALOG RECEPTY V DATABÁZI
Při sestavování jídelního plánu vybírej POUZE recipeId z tohoto katalogu. Pro každý typ jídla máš k dispozici celý seznam — střídej recepty, nevyužívej pořád stejné 2–3 položky.

${sections.join("\n\n")}`;
}
