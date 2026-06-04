import { addDaysIso, isoDateInPrague, mondayOfWeekContaining } from "@/lib/date-context";
import type { MealPlanDay } from "@/types";

export interface MealPlanWeekConflict {
  conflictingWeekStart: string;
  conflictingWeekEnd: string;
  existingPlanId: string;
  existingPlanTitle: string;
  suggestedNextWeekStart: string;
  suggestedNextWeekEnd: string;
}

export type UserMealPlanRecord = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  days: MealPlanDay[];
};

export function weekRangeFromMonday(monday: string): { start: string; end: string } {
  return { start: monday, end: addDaysIso(monday, 6) };
}

export function weekKeysForPlan(
  startDate: string,
  endDate: string,
  days?: MealPlanDay[]
): Set<string> {
  const keys = new Set<string>();
  const add = (iso: string) => keys.add(mondayOfWeekContaining(iso));

  if (days?.length) {
    for (const day of days) add(day.date);
    return keys;
  }

  let cur = startDate;
  while (cur <= endDate) {
    add(cur);
    cur = addDaysIso(cur, 1);
  }
  return keys;
}

export function detectMealPlanWeekConflict(
  existingPlans: UserMealPlanRecord[],
  proposed: { startDate: string; endDate: string; days: MealPlanDay[] }
): MealPlanWeekConflict | null {
  const proposedKeys = weekKeysForPlan(
    proposed.startDate,
    proposed.endDate,
    proposed.days
  );

  for (const existing of existingPlans) {
    const existingKeys = weekKeysForPlan(
      existing.startDate,
      existing.endDate,
      existing.days
    );

    for (const weekMonday of proposedKeys) {
      if (!existingKeys.has(weekMonday)) continue;

      const range = weekRangeFromMonday(weekMonday);
      const suggestedMonday = addDaysIso(weekMonday, 7);
      const suggested = weekRangeFromMonday(suggestedMonday);

      return {
        conflictingWeekStart: range.start,
        conflictingWeekEnd: range.end,
        existingPlanId: existing.id,
        existingPlanTitle: existing.title,
        suggestedNextWeekStart: suggested.start,
        suggestedNextWeekEnd: suggested.end,
      };
    }
  }

  return null;
}

export function buildExistingPlansContext(plans: UserMealPlanRecord[]): string {
  if (plans.length === 0) {
    return "## ULOŽENÉ JÍDELNÍ PLÁNY\nUživatelka zatím nemá žádný uložený jídelní plán.";
  }

  const lines = plans.map((p) => {
    const weeks = [...weekKeysForPlan(p.startDate, p.endDate, p.days)]
      .sort()
      .map((mon) => {
        const r = weekRangeFromMonday(mon);
        return `${r.start} – ${r.end}`;
      })
      .join("; ");
    return `- „${p.title}“ (týdny: ${weeks})`;
  });

  return `## ULOŽENÉ JÍDELNÍ PLÁNY (Europe/Prague, týden = po–ne)
${lines.join("\n")}

Pro každý kalendářní týden smí být uložen nejvýše jeden plán.`;
}

export function formatWeekRangeCs(start: string, end: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("cs-CZ", {
      day: "numeric",
      month: "long",
    });
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

export function withWeekConflict<T extends { startDate: string; endDate: string; days: MealPlanDay[] }>(
  payload: T,
  existingPlans: UserMealPlanRecord[]
): T & { weekConflict?: MealPlanWeekConflict } {
  const conflict = detectMealPlanWeekConflict(existingPlans, payload);
  if (!conflict) return payload;
  return { ...payload, weekConflict: conflict };
}

export function mealPlanConflictUserMessage(
  conflict: MealPlanWeekConflict
): string {
  const week = formatWeekRangeCs(
    conflict.conflictingWeekStart,
    conflict.conflictingWeekEnd
  );
  const next = formatWeekRangeCs(
    conflict.suggestedNextWeekStart,
    conflict.suggestedNextWeekEnd
  );
  return `Týden ${week} už má uložený plán „${conflict.existingPlanTitle}". Uložení je vypnuté, dokud nevybereš jiné období — např. následující týden (${next}) nebo napiš konkrétní datum začátku.`;
}
