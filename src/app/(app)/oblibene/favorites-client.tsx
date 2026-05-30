"use client";

import { useEffect, useState } from "react";
import { Heart, Trash2, Edit2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecipeCard } from "@/components/ui/recipe-card";
import type { FavoriteWithRecipe, RecipeData } from "@/types";

export function FavoritesClient() {
  const [favorites, setFavorites] = useState<FavoriteWithRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");

  useEffect(() => {
    fetchFavorites();
  }, []);

  async function fetchFavorites() {
    try {
      const res = await fetch("/api/favorites");
      const data = await res.json();
      setFavorites(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch("/api/favorites", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  }

  async function handleSaveNotes(id: string) {
    await fetch("/api/favorites", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, notes: editNotes }),
    });
    setFavorites((prev) =>
      prev.map((f) => (f.id === id ? { ...f, notes: editNotes } : f))
    );
    setEditingId(null);
  }

  function getEffectiveRecipe(fav: FavoriteWithRecipe): RecipeData | null {
    if (!fav.recipe) return null;
    return {
      ...fav.recipe,
      name: fav.customName ?? fav.recipe.name,
      ingredients: fav.customIngredients ?? fav.recipe.ingredients,
      instructions: fav.customInstructions ?? fav.recipe.instructions,
    };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-stone-400 text-sm">Načítám…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-stone-100 bg-white">
        <h1 className="text-base font-semibold text-stone-900">Oblíbené recepty</h1>
        <p className="text-xs text-stone-500">{favorites.length} uložených receptů</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
              <Heart className="h-8 w-8 text-red-300" />
            </div>
            <h2 className="text-base font-semibold text-stone-700 mb-2">
              Zatím žádné oblíbené
            </h2>
            <p className="text-sm text-stone-400 max-w-xs leading-relaxed">
              V chatu si přidej recepty do oblíbených kliknutím na srdíčko
              u receptu.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {favorites.map((fav) => {
              const recipe = getEffectiveRecipe(fav);
              const isExpanded = expandedId === fav.id;

              return (
                <div
                  key={fav.id}
                  className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        className="flex-1 text-left"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : fav.id)
                        }
                      >
                        <h3 className="text-base font-semibold text-stone-900 leading-snug">
                          {fav.customName ?? fav.recipe?.name ?? "Recept"}
                        </h3>
                        {fav.recipe && !fav.customName && (
                          <p className="text-xs text-stone-400 mt-0.5">
                            {fav.recipe.description.slice(0, 80)}…
                          </p>
                        )}
                      </button>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingId(fav.id);
                            setEditNotes(fav.notes ?? "");
                          }}
                          className="text-stone-400"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(fav.id)}
                          className="text-stone-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : fav.id)
                          }
                          className="text-stone-400"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {fav.notes && editingId !== fav.id && (
                      <p className="mt-2 text-xs text-stone-500 italic bg-stone-50 rounded-lg px-3 py-2">
                        {fav.notes}
                      </p>
                    )}

                    {editingId === fav.id && (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Přidej poznámku k receptu…"
                          className="w-full text-sm rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveNotes(fav.id)}
                          >
                            Uložit
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setEditingId(null)}
                          >
                            Zrušit
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {isExpanded && recipe && (
                    <div className="border-t border-stone-100">
                      <RecipeCard recipe={recipe} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
