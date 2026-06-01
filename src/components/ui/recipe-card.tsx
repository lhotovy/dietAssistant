"use client";

import { useState } from "react";
import {
  Clock,
  ChefHat,
  Users,
  ChevronDown,
  ChevronUp,
  Heart,
} from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import type { RecipeData } from "@/types";
import { MEAL_TYPE_LABELS, type MealType } from "@/types";

interface RecipeCardProps {
  recipe: RecipeData;
  onSaveToFavorites?: (recipe: RecipeData) => void;
  isFavorite?: boolean;
  compact?: boolean;
}

export function RecipeCard({
  recipe,
  onSaveToFavorites,
  isFavorite = false,
  compact = false,
}: RecipeCardProps) {
  const [expanded, setExpanded] = useState(!compact);

  const mealTypeLabels = recipe.mealTypes
    .map((t) => MEAL_TYPE_LABELS[t as MealType] ?? t)
    .join(", ");

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1">
            <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
              {mealTypeLabels}
            </span>
            <h3 className="mt-1.5 text-base font-semibold text-stone-900 leading-snug">
              {recipe.name}
            </h3>
          </div>
          {onSaveToFavorites && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onSaveToFavorites(recipe)}
              className={cn(
                "flex-shrink-0",
                isFavorite ? "text-red-500" : "text-stone-400"
              )}
              title={isFavorite ? "Odebrat z oblíbených" : "Přidat do oblíbených"}
            >
              <Heart
                className="h-5 w-5"
                fill={isFavorite ? "currentColor" : "none"}
              />
            </Button>
          )}
        </div>

        <p
          className={cn(
            "text-sm text-stone-500 leading-relaxed mb-3",
            compact && !expanded && "line-clamp-2"
          )}
        >
          {recipe.description}
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>Příprava: {recipe.prepTime} min</span>
          </span>
          {recipe.cookTime > 0 && (
            <span className="flex items-center gap-1">
              <ChefHat className="h-3.5 w-3.5" />
              <span>Vaření: {recipe.cookTime} min</span>
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            <span>{recipe.servings} porce</span>
          </span>
        </div>
      </div>

      {compact && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full flex items-center justify-center gap-1 py-2.5 text-sm text-green-700 font-medium border-t border-stone-100 hover:bg-stone-50 transition-colors"
        >
          <ChevronDown className="h-4 w-4" />
          Zobrazit celý recept
        </button>
      )}

      {expanded && (
        <div className="border-t border-stone-100 p-4 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-stone-700 mb-2">
              Ingredience
            </h4>
            <ul className="space-y-1">
              {recipe.ingredients.map((ing, i) => (
                <li
                  key={i}
                  className="flex items-baseline justify-between text-sm"
                >
                  <span className="text-stone-700">{ing.name}</span>
                  <span className="text-stone-500 ml-2 flex-shrink-0">
                    {ing.amount} {ing.unit}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-stone-700 mb-2">
              Postup
            </h4>
            <ol className="space-y-2">
              {recipe.instructions.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-semibold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-stone-700 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {compact && expanded && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="w-full flex items-center justify-center gap-1 py-2.5 text-sm text-green-700 font-medium border-t border-stone-100 hover:bg-stone-50 transition-colors"
        >
          <ChevronUp className="h-4 w-4" />
          Skrýt recept
        </button>
      )}
    </div>
  );
}
