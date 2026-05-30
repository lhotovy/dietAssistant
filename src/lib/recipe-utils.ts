import type { Recipe } from "@/generated/prisma/client";
import type { RecipeData, RecipeIngredient } from "@/types";

export function parseRecipe(recipe: Recipe): RecipeData {
  return {
    id: recipe.id,
    name: recipe.name,
    slug: recipe.slug,
    description: recipe.description,
    mealTypes: recipe.mealTypes.split(",").map((s) => s.trim()),
    ingredients: JSON.parse(recipe.ingredients) as RecipeIngredient[],
    instructions: JSON.parse(recipe.instructions) as string[],
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    servings: recipe.servings,
    tags: recipe.tags ? recipe.tags.split(",").map((s) => s.trim()) : [],
    source: recipe.source,
  };
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
