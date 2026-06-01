"use client";

import { useState } from "react";
import type { UIMessage } from "ai";
import { RecipeCard } from "@/components/ui/recipe-card";
import type { RecipeData } from "@/types";
import { isMealPlanPayload } from "@/lib/meal-plan-parse";
import {
  extractMealPlansFromMessage,
  getAssistantDisplayText,
} from "@/lib/meal-plan-from-message";
import { stripHiddenJsonBlocks } from "@/lib/message-display";
import { MealPlanSaveCard } from "./meal-plan-save-card";

interface ChatMessageProps {
  message: UIMessage;
  isStreaming?: boolean;
}

function extractRecipes(text: string): RecipeData[] {
  const recipes: RecipeData[] = [];
  const jsonBlocks = text.matchAll(/```json\s*([\s\S]*?)```/g);
  for (const match of jsonBlocks) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        recipes.push(
          ...parsed.filter(
            (item) => isRecipeData(item) && !isMealPlanPayload(item)
          )
        );
      } else if (isRecipeData(parsed) && !isMealPlanPayload(parsed)) {
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

export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  const [savedRecipes, setSavedRecipes] = useState<Set<string>>(new Set());

  if (message.role === "system") return null;

  const isUser = message.role === "user";

  const fullText = isUser
    ? (message.parts
        ?.filter(
          (p): p is { type: "text"; text: string } =>
            typeof p === "object" &&
            p !== null &&
            "type" in p &&
            p.type === "text" &&
            "text" in p
        )
        .map((p) => p.text)
        .join("") ?? "")
    : getAssistantDisplayText(message);

  const recipes = isUser ? [] : extractRecipes(fullText);
  const mealPlans =
    isUser || isStreaming ? [] : extractMealPlansFromMessage(message);
  const displayText = isUser ? fullText : stripHiddenJsonBlocks(fullText);
  const hasPrepareTool = message.parts?.some((p) => {
    if (typeof p !== "object" || p === null) return false;
    const r = p as Record<string, unknown>;
    const type = String(r.type ?? "");
    return (
      type.includes("prepareMealPlan") || r.toolName === "prepareMealPlan"
    );
  });

  const looksLikeWeeklyPlan =
    /pondělí|úterý|středa|čtvrtek|pátek|sobota|neděle/i.test(displayText) &&
    /snídaně|oběd|večeře/i.test(displayText);

  const prepareIncomplete =
    !isUser &&
    !isStreaming &&
    mealPlans.length === 0 &&
    looksLikeWeeklyPlan &&
    !hasPrepareTool;

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

  if (!displayText && recipes.length === 0 && mealPlans.length === 0)
    return null;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`${isUser ? "max-w-[75%]" : "w-full max-w-full"}`}>
        {isUser ? (
          <div className="bg-fuchsia-800 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-base leading-relaxed">
            {displayText}
          </div>
        ) : (
          <div className="space-y-3">
            {displayText && (
              <div className="bg-stone-50 rounded-2xl rounded-tl-sm px-4 py-3 text-base text-stone-800 leading-relaxed">
                {renderText(displayText)}
              </div>
            )}
            {mealPlans.map((plan, i) => (
              <MealPlanSaveCard
                key={`meal-plan-${i}-${plan.startDate}-${plan.endDate}`}
                plan={plan}
              />
            ))}
            {prepareIncomplete && (
              <p className="text-base text-amber-700 bg-amber-50 rounded-xl px-4 py-3">
                Plán zatím nelze uložit — odpověď nebyla dokončena. Požádej znovu:
                „Dokonči plán pro uložení podle katalogu receptů.“
              </p>
            )}
            {recipes.map((recipe, i) => (
              <RecipeCard
                key={`recipe-${i}-${recipe.id ?? recipe.slug ?? recipe.name}`}
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
