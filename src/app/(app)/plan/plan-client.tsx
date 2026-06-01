"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Trash2, ChevronDown, ChevronUp, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { MealPlanDay, MealType, RecipeData } from "@/types";
import { useUserSessionReady } from "@/components/user-session-provider";
import { PlanMealSlot } from "@/components/plan/plan-meal-slot";
import { RecipePicker } from "@/components/plan/recipe-picker";

interface MealPlan {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  days: MealPlanDay[];
  createdAt: string;
}

interface PickerTarget {
  planId: string;
  dayIndex: number;
  mealIndex: number;
  mealType: MealType;
}

const DAY_NAMES = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];
const MONTH_NAMES = [
  "ledna", "února", "března", "dubna", "května", "června",
  "července", "srpna", "září", "října", "listopadu", "prosince",
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()}. ${MONTH_NAMES[d.getMonth()]}`;
}

function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}. ${MONTH_NAMES[d.getMonth()]}`;
}

export function PlanClient() {
  const userReady = useUserSessionReady();
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (!userReady) return;
    fetchPlans();
  }, [userReady]);

  async function fetchPlans() {
    try {
      const res = await fetch("/api/plans");
      const data = await res.json();
      setPlans(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch("/api/plans", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setPlans((prev) => prev.filter((p) => p.id !== id));
  }

  const persistPlanDays = useCallback(
    async (planId: string, days: MealPlanDay[]) => {
      setSavingPlanId(planId);
      try {
        const res = await fetch("/api/plans", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: planId, days }),
        });
        if (!res.ok) return;
        const updated = (await res.json()) as MealPlan;
        setPlans((prev) =>
          prev.map((p) =>
            p.id === planId
              ? {
                  ...p,
                  days: updated.days,
                }
              : p
          )
        );
      } finally {
        setSavingPlanId(null);
      }
    },
    []
  );

  function updatePlanDays(
    planId: string,
    updater: (days: MealPlanDay[]) => MealPlanDay[]
  ) {
    let nextDays: MealPlanDay[] | null = null;
    setPlans((prev) =>
      prev.map((p) => {
        if (p.id !== planId) return p;
        nextDays = updater(p.days);
        return { ...p, days: nextDays };
      })
    );
    if (nextDays) void persistPlanDays(planId, nextDays);
  }

  function handleRemoveMeal(
    planId: string,
    dayIndex: number,
    mealIndex: number
  ) {
    updatePlanDays(planId, (days) => {
      const copy = structuredClone(days);
      const meal = copy[dayIndex].meals[mealIndex];
      copy[dayIndex].meals[mealIndex] = { type: meal.type };
      return copy;
    });
  }

  function handleSelectRecipe(recipe: RecipeData) {
    if (!picker) return;
    const { planId, dayIndex, mealIndex, mealType } = picker;
    updatePlanDays(planId, (days) => {
      const copy = structuredClone(days);
      copy[dayIndex].meals[mealIndex] = {
        type: mealType,
        recipeId: recipe.id,
        recipeName: recipe.name,
      };
      return copy;
    });
    setPicker(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-stone-400 text-sm">Načítám…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-stone-100 bg-white">
        <h1 className="text-base font-semibold text-stone-900">Jídelní plány</h1>
        <p className="text-xs text-stone-500">{plans.length} uložených plánů</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
              <CalendarDays className="h-8 w-8 text-blue-300" />
            </div>
            <h2 className="text-base font-semibold text-stone-700 mb-2">
              Zatím žádné plány
            </h2>
            <p className="text-sm text-stone-400 max-w-xs leading-relaxed mb-4">
              Požádej asistenta o sestavení jídelního plánu. Stačí napsat
              například: „Vytvoř mi jídelní plán na příští týden."
            </p>
            <Link href="/chat">
              <Button variant="primary" size="md" className="gap-2">
                <MessageCircle className="h-4 w-4" />
                Otevřít chat
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map((plan) => {
              const isExpanded = expandedId === plan.id;
              const isSaving = savingPlanId === plan.id;
              return (
                <div
                  key={plan.id}
                  className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm"
                >
                  <div className="flex items-center gap-1 p-4">
                    <button
                      type="button"
                      className="flex-1 min-w-0 text-left"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : plan.id)
                      }
                    >
                      <h3 className="text-base font-semibold text-stone-900">
                        {plan.title}
                      </h3>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {formatDate(plan.startDate)} –{" "}
                        {formatDate(plan.endDate)}
                        {isSaving && (
                          <span className="ml-2 text-green-600">Ukládám…</span>
                        )}
                      </p>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(plan.id)}
                      className="text-stone-400 hover:text-red-500 shrink-0"
                      aria-label="Smazat plán"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : plan.id)
                      }
                      className="shrink-0 p-2 -mr-2 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-50"
                      aria-label={isExpanded ? "Sbalit plán" : "Rozbalit plán"}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-stone-100 divide-y divide-stone-100">
                      {plan.days.map((day, dayIndex) => (
                        <div key={dayIndex} className="p-4">
                          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                            {formatDayHeader(day.date)}
                          </p>
                          <div className="space-y-1.5">
                            {day.meals.map((meal, mealIndex) => (
                              <PlanMealSlot
                                key={`${dayIndex}-${mealIndex}-${meal.recipeId ?? "empty"}`}
                                meal={meal}
                                onRemove={() =>
                                  handleRemoveMeal(plan.id, dayIndex, mealIndex)
                                }
                                onPick={() =>
                                  setPicker({
                                    planId: plan.id,
                                    dayIndex,
                                    mealIndex,
                                    mealType: meal.type as MealType,
                                  })
                                }
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {picker && (
        <RecipePicker
          mealType={picker.mealType}
          onSelect={handleSelectRecipe}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
