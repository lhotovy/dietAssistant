import type { MealPlanPayload } from "@/lib/meal-plan-parse";
import type { MealType } from "@/types";

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  snidane: "Snídaně",
  obed: "Oběd",
  vecere: "Večeře",
  svacina: "Svačina",
  dessert: "Dezert",
};

function formatPlanDayHeading(dateIso: string): string {
  const d = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateIso;
  const weekday = d.toLocaleDateString("cs-CZ", { weekday: "long" });
  const capitalized =
    weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const rest = d.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "long",
  });
  return `${capitalized} ${rest}`;
}

/** Markdown overview from tool/saved plan (names from DB). */
export function formatMealPlanSummaryMarkdown(plan: MealPlanPayload): string {
  const lines: string[] = [
    `Tady je návrh jídelníčku **${plan.title}**.`,
    "",
  ];

  for (const day of plan.days) {
    lines.push(`### ${formatPlanDayHeading(day.date)}`);
    for (const meal of day.meals) {
      if (!meal.recipeId && !meal.recipeName) continue;
      const label = MEAL_TYPE_LABELS[meal.type] ?? meal.type;
      const name =
        meal.recipeName?.trim() || "Neznámý recept";
      lines.push(`- **${label}:** ${name}`);
    }
    lines.push("");
  }

  lines.push(
    "Plán je připraven k uložení — použijte tlačítko níže (do databáze se uloží až po kliknutí)."
  );
  return lines.join("\n").trim();
}
