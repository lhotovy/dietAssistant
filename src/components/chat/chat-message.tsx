"use client";

import { useState } from "react";
import type { UIMessage } from "ai";
import { RecipeCard } from "@/components/ui/recipe-card";
import type { RecipeData } from "@/types";

interface ChatMessageProps {
  message: UIMessage;
}

function extractRecipes(text: string): RecipeData[] {
  const recipes: RecipeData[] = [];
  const jsonBlocks = text.matchAll(/```json\s*([\s\S]*?)```/g);
  for (const match of jsonBlocks) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        recipes.push(...parsed.filter(isRecipeData));
      } else if (isRecipeData(parsed)) {
        recipes.push(parsed);
      }
    } catch {
      // ignore malformed JSON
    }
  }
  return recipes;
}

function isRecipeData(obj: unknown): obj is RecipeData {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "name" in obj &&
    "ingredients" in obj &&
    "instructions" in obj
  );
}

function cleanText(text: string): string {
  return text.replace(/```json\s*[\s\S]*?```/g, "").trim();
}

function renderText(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={i}>
        {i > 0 && <br />}
        {parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={j}>{part.slice(2, -2)}</strong>
          ) : (
            <span key={j}>{part}</span>
          )
        )}
      </span>
    );
  });
}

export function ChatMessage({ message }: ChatMessageProps) {
  const [savedRecipes, setSavedRecipes] = useState<Set<string>>(new Set());

  if (message.role === "system") return null;

  const isUser = message.role === "user";

  // Extract text from parts (new AI SDK format)
  const textParts = message.parts?.filter(
    (p): p is { type: "text"; text: string } => p.type === "text"
  ) ?? [];
  const fullText = textParts.map((p) => p.text).join("");

  const recipes = isUser ? [] : extractRecipes(fullText);
  const displayText = isUser ? fullText : cleanText(fullText);

  const handleSaveToFavorites = async (recipe: RecipeData) => {
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeId: recipe.id,
          name: recipe.name,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
        }),
      });
      if (res.ok) {
        setSavedRecipes((prev) => new Set([...prev, recipe.id ?? recipe.name]));
      }
    } catch {
      // silently fail
    }
  };

  if (!displayText && recipes.length === 0) return null;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`${isUser ? "max-w-[75%]" : "w-full max-w-full"}`}>
        {isUser ? (
          <div className="bg-green-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed">
            {displayText}
          </div>
        ) : (
          <div className="space-y-3">
            {displayText && (
              <div className="bg-stone-50 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-stone-800 leading-relaxed">
                {renderText(displayText)}
              </div>
            )}
            {recipes.map((recipe, i) => (
              <RecipeCard
                key={`${recipe.id ?? recipe.name}-${i}`}
                recipe={recipe}
                onSaveToFavorites={handleSaveToFavorites}
                isFavorite={savedRecipes.has(recipe.id ?? recipe.name)}
                compact
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
