export interface RecipeIngredient {
  name: string;
  amount: number;
  unit: string;
}

export interface RecipeData {
  id: string;
  name: string;
  slug: string;
  description: string;
  mealTypes: string[];
  ingredients: RecipeIngredient[];
  instructions: string[];
  prepTime: number;
  cookTime: number;
  servings: number;
  tags: string[];
  source?: string | null;
}

export interface MealPlanDay {
  date: string; // ISO date string
  meals: {
    type: "snidane" | "obed" | "vecere" | "svacina" | "dessert";
    /** Required for plans saved from chat — links to Recipe.id */
    recipeId: string;
    recipeName: string;
    customRecipe?: Partial<RecipeData>;
  }[];
}

export interface FavoriteWithRecipe {
  id: string;
  userId: string;
  recipeId: string | null;
  recipe: RecipeData | null;
  customName: string | null;
  customIngredients: RecipeIngredient[] | null;
  customInstructions: string[] | null;
  notes: string | null;
  createdAt: Date;
}

export type MealType = "snidane" | "obed" | "vecere" | "svacina" | "dessert";

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  snidane: "Snídaně",
  obed: "Oběd",
  vecere: "Večeře",
  svacina: "Svačina",
  dessert: "Dezert",
};
