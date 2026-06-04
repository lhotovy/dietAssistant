"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mealPlanConflictUserMessage } from "@/lib/meal-plan-conflicts";
import type { MealPlanPayload } from "@/lib/meal-plan-parse";

interface MealPlanSaveCardProps {
  plan: MealPlanPayload;
  /** Plan was already persisted (e.g. via saveMealPlan tool). */
  alreadySaved?: boolean;
}

function formatDateRange(start: string, end: string): string {
  const fmt = (s: string) => {
    const d = new Date(s);
    return d.toLocaleDateString("cs-CZ", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

export function MealPlanSaveCard({
  plan,
  alreadySaved = false,
}: MealPlanSaveCardProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(alreadySaved);
  const [error, setError] = useState<string | null>(null);

  const mealCount = plan.days.reduce((n, d) => n + d.meals.length, 0);
  const hasWeekConflict = Boolean(plan.weekConflict);
  const saveDisabled = hasWeekConflict || saving;

  const handleSave = async () => {
    if (hasWeekConflict) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: plan.title,
          startDate: plan.startDate,
          endDate: plan.endDate,
          days: plan.days,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data.error === "string" ? data.error : "Uložení se nezdařilo"
        );
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Uložení se nezdařilo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
          <CalendarDays className="h-5 w-5 text-blue-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-stone-900">{plan.title}</h4>
          <p className="text-xs text-stone-600 mt-0.5">
            {formatDateRange(plan.startDate, plan.endDate)}
          </p>
          <p className="text-xs text-stone-500 mt-1">
            {plan.days.length} dní · {mealCount} jídel
          </p>
        </div>
      </div>

      {saved ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-green-700 flex items-center gap-1.5">
            <Check className="h-4 w-4" />
            Jídelní plán byl uložen
          </p>
          <Link href="/plan">
            <Button variant="secondary" size="sm" className="w-full">
              Zobrazit v plánech
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {hasWeekConflict && plan.weekConflict && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 leading-relaxed">
              {mealPlanConflictUserMessage(plan.weekConflict)}
            </p>
          )}
          <Button
            variant="primary"
            size="md"
            className="w-full"
            onClick={handleSave}
            disabled={saveDisabled}
            title={
              hasWeekConflict
                ? "Nejdřív vyřeš kolizi týdne v rozhovoru"
                : undefined
            }
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Ukládám…
              </>
            ) : (
              "Uložit jídelní plán"
            )}
          </Button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
