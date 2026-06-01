"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanMealItem } from "@/components/plan/plan-meal-item";
import type { MealPlanDay } from "@/types";
import { MEAL_TYPE_LABELS, type MealType } from "@/types";

type PlanMeal = MealPlanDay["meals"][number];

interface PlanMealSlotProps {
  meal: PlanMeal;
  onRemove: () => void;
  onPick: () => void;
}

export function PlanMealSlot({ meal, onRemove, onPick }: PlanMealSlotProps) {
  const label = MEAL_TYPE_LABELS[meal.type as MealType] ?? meal.type;
  const hasRecipe = Boolean(meal.recipeId);

  if (!hasRecipe) {
    return (
      <div className="flex items-center gap-1">
        <div className="flex-1 min-w-0 flex items-center gap-2 text-sm px-1 py-1 -mx-1">
          <span className="shrink-0 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full min-w-[64px] text-center">
            {label}
          </span>
          <span className="flex-1 min-w-0 text-stone-400 italic">Prázdné místo</span>
          <span className="h-4 w-4 shrink-0" aria-hidden />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onPick}
          className="h-8 w-8 shrink-0 text-green-600 hover:text-green-700 hover:bg-green-50"
          aria-label="Vybrat recept"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <PlanMealItem
      meal={meal}
      trailing={
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-8 w-8 shrink-0 text-stone-400 hover:text-red-500 hover:bg-red-50"
          aria-label="Odebrat jídlo"
        >
          <Minus className="h-4 w-4" />
        </Button>
      }
    />
  );
}
