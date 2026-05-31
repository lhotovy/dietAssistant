"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { RecipeCard } from "@/components/ui/recipe-card";
import type { MealPlanDay } from "@/types";
import { MEAL_TYPE_LABELS, type MealType } from "@/types";
import type { RecipeData } from "@/types";

type PlanMeal = MealPlanDay["meals"][number];

interface PlanMealItemProps {
  meal: PlanMeal;
}

export function PlanMealItem({ meal }: PlanMealItemProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recipe, setRecipe] = useState<RecipeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const label = MEAL_TYPE_LABELS[meal.type as MealType] ?? meal.type;
  const recipeName = meal.recipeName ?? "Recept";
  const hasRecipeId = Boolean(meal.recipeId);

  async function loadAndToggle() {
    if (!hasRecipeId) return;

    if (open) {
      setOpen(false);
      return;
    }

    if (recipe) {
      setOpen(true);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/recipes?id=${encodeURIComponent(meal.recipeId!)}`
      );
      if (!res.ok) {
        setError("Recept v databázi nebyl nalezen.");
        return;
      }
      const data = (await res.json()) as RecipeData;
      setRecipe(data);
      setOpen(true);
    } catch {
      setError("Nepodařilo se načíst recept.");
    } finally {
      setLoading(false);
    }
  }

  if (!hasRecipeId) {
    return (
      <div className="flex items-center gap-2 text-sm px-1 py-1">
        <span className="flex-shrink-0 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full min-w-[64px] text-center">
          {label}
        </span>
        <span className="text-stone-500">{recipeName}</span>
        <span className="text-xs text-stone-400">(bez odkazu na recept)</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={loadAndToggle}
        disabled={loading}
        className="w-full flex items-center gap-2 text-sm text-left rounded-lg hover:bg-stone-50 px-1 py-1 -mx-1 transition-colors disabled:opacity-60"
      >
        <span className="flex-shrink-0 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full min-w-[64px] text-center">
          {label}
        </span>
        <span className="text-stone-700 flex-1 underline decoration-stone-300 underline-offset-2">
          {recipeName}
        </span>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-stone-400 flex-shrink-0" />
        ) : open ? (
          <ChevronUp className="h-4 w-4 text-stone-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-stone-400 flex-shrink-0" />
        )}
      </button>

      {error && <p className="text-xs text-red-600 pl-1">{error}</p>}

      {open && recipe && <RecipeCard recipe={recipe} compact />}
    </div>
  );
}
