"use client";

import { useMemo, useState } from "react";
import type { UIMessage } from "ai";
import { RecipeCard } from "@/components/ui/recipe-card";
import type { RecipeData } from "@/types";
import { isMealPlanPayload } from "@/lib/meal-plan-parse";
import {
  extractAssistantSavedMealPlan,
  extractMealPlanToolError,
  extractPreparedMealPlans,
  getAssistantDisplayText,
} from "@/lib/meal-plan-from-message";
import {
  buildRecipeNameMaps,
  enrichMealPlanPayloadNames,
} from "@/lib/meal-plan-enrich-names";
import { formatMealPlanSummaryMarkdown } from "@/lib/meal-plan-display";
import { usePlanningCatalog } from "./planning-catalog-provider";
import {
  messageClaimsPlanSaved,
  stripAssistantPlanDisplayText,
} from "@/lib/message-display";
import { MealPlanSaveCard } from "./meal-plan-save-card";
import { MarkdownContent } from "./markdown-content";

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

  const { recipes: catalogRecipes } = usePlanningCatalog();
  const nameMaps = useMemo(
    () => buildRecipeNameMaps(catalogRecipes),
    [catalogRecipes]
  );

  const recipes = isUser ? [] : extractRecipes(fullText);
  const assistantSaved = isUser ? null : extractAssistantSavedMealPlan(message);
  const rawMealPlans = isUser ? [] : extractPreparedMealPlans(message);
  const mealPlans = useMemo(
    () =>
      rawMealPlans.map((plan) => enrichMealPlanPayloadNames(plan, nameMaps)),
    [rawMealPlans, nameMaps]
  );
  const prepareToolError = isUser ? null : extractMealPlanToolError(message);
  const planWasSavedByTool = Boolean(assistantSaved);
  const savedPlanEnriched = useMemo(
    () =>
      assistantSaved
        ? {
            ...assistantSaved,
            plan: enrichMealPlanPayloadNames(assistantSaved.plan, nameMaps),
          }
        : null,
    [assistantSaved, nameMaps]
  );
  const planForSummary =
    mealPlans[0] ?? savedPlanEnriched?.plan ?? null;
  const summaryFromTool = planForSummary
    ? formatMealPlanSummaryMarkdown(planForSummary)
    : "";

  const strippedText = isUser
    ? fullText
    : stripAssistantPlanDisplayText(fullText, {
        planWasSavedByTool,
        hasPreparedPlanFromTool: mealPlans.length > 0,
        hidePhantomWeeklyPlan:
          mealPlans.length > 0 || Boolean(prepareToolError),
      });

  const displayText =
    isUser || strippedText.trim().length > 0
      ? strippedText
      : summaryFromTool;
  const falseSaveClaimInText =
    !isUser &&
    !isStreaming &&
    !planWasSavedByTool &&
    messageClaimsPlanSaved(fullText);
  const hasMealPlanTool = message.parts?.some((p) => {
    if (typeof p !== "object" || p === null) return false;
    const r = p as Record<string, unknown>;
    const type = String(r.type ?? "");
    return (
      type.includes("prepareMealPlan") ||
      type.includes("saveMealPlan") ||
      r.toolName === "prepareMealPlan" ||
      r.toolName === "saveMealPlan"
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
    !hasMealPlanTool;

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

  if (
    !displayText &&
    recipes.length === 0 &&
    mealPlans.length === 0 &&
    !assistantSaved
  )
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
                <MarkdownContent text={displayText} />
              </div>
            )}
            {savedPlanEnriched && (
              <MealPlanSaveCard
                key={`meal-plan-saved-${savedPlanEnriched.planId}`}
                plan={savedPlanEnriched.plan}
                alreadySaved
              />
            )}
            {falseSaveClaimInText && mealPlans.length > 0 && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 leading-relaxed">
                Plán zatím není uložen v databázi — uložte ho tlačítkem níže, nebo
                požádejte asistentku: „ulož plán“.
              </p>
            )}
            {mealPlans.map((plan, i) => (
              <MealPlanSaveCard
                key={`meal-plan-${i}-${plan.startDate}-${plan.endDate}`}
                plan={plan}
              />
            ))}
            {prepareToolError && mealPlans.length === 0 && (
              <p className="text-base text-red-700 bg-red-50 rounded-xl px-4 py-3">
                {prepareToolError}
              </p>
            )}
            {prepareIncomplete && !prepareToolError && (
              <p className="text-base text-amber-700 bg-amber-50 rounded-xl px-4 py-3">
                Plán zatím nelze uložit — chybí volání nástroje pro uložení. Požádej:
                „Dokonči plán a připrav ho k uložení podle katalogu receptů.“
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
