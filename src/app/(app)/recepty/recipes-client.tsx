"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, UtensilsCrossed } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RecipeCard } from "@/components/ui/recipe-card";
import { cn } from "@/lib/utils";
import type { MealType, RecipeData } from "@/types";
import { MEAL_TYPE_LABELS, MEAL_TYPES } from "@/types";
import { useUserSessionReady } from "@/components/user-session-provider";

type MealFilter = MealType | "all";

export function RecipesClient() {
  const userReady = useUserSessionReady();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [mealFilter, setMealFilter] = useState<MealFilter>("all");
  const [recipes, setRecipes] = useState<RecipeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoriteRecipeIds, setFavoriteRecipeIds] = useState<Set<string>>(
    new Set()
  );
  const [recipeToDelete, setRecipeToDelete] = useState<RecipeData | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const loadFavorites = useCallback(async () => {
    const res = await fetch("/api/favorites");
    if (!res.ok) return;
    const data = (await res.json()) as { recipeId: string | null }[];
    setFavoriteRecipeIds(
      new Set(
        data.map((f) => f.recipeId).filter((id): id is string => Boolean(id))
      )
    );
  }, []);

  useEffect(() => {
    if (!userReady) return;
    void loadFavorites();
  }, [userReady, loadFavorites]);

  useEffect(() => {
    if (!userReady) return;

    const controller = new AbortController();

    async function loadRecipes() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: "500" });
        if (debouncedQuery) params.set("q", debouncedQuery);
        if (mealFilter !== "all") params.set("mealType", mealFilter);

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
    }

    void loadRecipes();
    return () => controller.abort();
  }, [userReady, debouncedQuery, mealFilter]);

  async function handleSaveToFavorites(recipe: RecipeData) {
    const isFavorite = favoriteRecipeIds.has(recipe.id);
    try {
      if (isFavorite) {
        const res = await fetch("/api/favorites");
        if (!res.ok) return;
        const favorites = (await res.json()) as {
          id: string;
          recipeId: string | null;
        }[];
        const fav = favorites.find((f) => f.recipeId === recipe.id);
        if (!fav) return;
        const del = await fetch("/api/favorites", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: fav.id }),
        });
        if (del.ok) {
          setFavoriteRecipeIds((prev) => {
            const next = new Set(prev);
            next.delete(recipe.id);
            return next;
          });
        }
      } else {
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipeId: recipe.id }),
        });
        if (res.ok) {
          setFavoriteRecipeIds((prev) => new Set([...prev, recipe.id]));
        }
      }
    } catch {
      // silently fail
    }
  }

  async function handleConfirmDelete() {
    if (!recipeToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/recipes/${recipeToDelete.slug}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setRecipes((prev) => prev.filter((r) => r.id !== recipeToDelete.id));
        setFavoriteRecipeIds((prev) => {
          const next = new Set(prev);
          next.delete(recipeToDelete.id);
          return next;
        });
        setRecipeToDelete(null);
      }
    } catch {
      // silently fail
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-stone-100 bg-white shrink-0">
        <h1 className="text-base font-semibold text-stone-900">Recepty</h1>
        <p className="text-xs text-stone-500">
          Prohlížej jídla a postupy bez chatu
        </p>
      </div>

      <div className="px-4 py-3 border-b border-stone-100 bg-white space-y-3 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hledat podle názvu, popisu nebo štítku…"
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setMealFilter("all")}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              mealFilter === "all"
                ? "bg-stone-800 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            )}
          >
            Vše
          </button>
          {MEAL_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setMealFilter(type)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                mealFilter === type
                  ? "bg-stone-800 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              )}
            >
              {MEAL_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-stone-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : recipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center px-4 py-12">
            <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
              <UtensilsCrossed className="h-8 w-8 text-stone-400" />
            </div>
            <h2 className="text-base font-semibold text-stone-700 mb-2">
              Žádné recepty
            </h2>
            <p className="text-sm text-stone-400 max-w-xs">
              Zkus jiný filtr nebo uprav hledaný výraz.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-stone-500">
              {recipes.length}{" "}
              {recipes.length === 1
                ? "recept"
                : recipes.length < 5
                  ? "recepty"
                  : "receptů"}
            </p>
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                compact
                onSaveToFavorites={handleSaveToFavorites}
                onDelete={setRecipeToDelete}
                isFavorite={favoriteRecipeIds.has(recipe.id)}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={recipeToDelete !== null}
        title="Smazat recept?"
        description={
          recipeToDelete
            ? `Opravdu chceš smazat „${recipeToDelete.name}"? Tuto akci nelze vrátit.`
            : ""
        }
        loading={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          if (!deleting) setRecipeToDelete(null);
        }}
      />
    </div>
  );
}
