"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MealType, RecipeData } from "@/types";
import { MEAL_TYPE_LABELS } from "@/types";

interface RecipePickerProps {
  mealType: MealType;
  onSelect: (recipe: RecipeData) => void;
  onClose: () => void;
}

export function RecipePicker({ mealType, onSelect, onClose }: RecipePickerProps) {
  const [query, setQuery] = useState("");
  const [recipes, setRecipes] = useState<RecipeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ mealType });
        if (query.trim()) params.set("q", query.trim());
        const res = await fetch(`/api/recipes?${params}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          setRecipes((await res.json()) as RecipeData[]);
        }
      } catch {
        if (!controller.signal.aborted) setRecipes([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, query ? 250 : 0);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [mealType, query]);

  return (
    <div
      className="fixed inset-x-0 top-0 bottom-14 z-[60] flex items-end sm:inset-0 sm:bottom-0 sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipe-picker-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-stone-900/40"
        aria-label="Zavřít"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-md max-h-full sm:max-h-[85vh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-stone-200">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-stone-100">
          <div>
            <h2
              id="recipe-picker-title"
              className="text-base font-semibold text-stone-900"
            >
              Vybrat recept
            </h2>
            <p className="text-xs text-stone-500">
              {MEAL_TYPE_LABELS[mealType]}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Zavřít">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-4 py-3 border-b border-stone-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hledat recept…"
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              autoFocus
            />
          </div>
        </div>

        <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-stone-100 pb-safe">
          {loading ? (
            <li className="flex items-center justify-center py-12 text-stone-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </li>
          ) : recipes.length === 0 ? (
            <li className="py-12 text-center text-sm text-stone-400 px-4">
              Žádné recepty nenalezeny
            </li>
          ) : (
            recipes.map((recipe) => (
              <li key={recipe.id}>
                <button
                  type="button"
                  onClick={() => onSelect(recipe)}
                  className="w-full px-4 py-3 text-left hover:bg-stone-50 transition-colors"
                >
                  <p className="text-sm font-medium text-stone-900">
                    {recipe.name}
                  </p>
                  {recipe.description && (
                    <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">
                      {recipe.description}
                    </p>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
