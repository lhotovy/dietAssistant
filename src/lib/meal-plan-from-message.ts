import type { UIMessage } from "ai";
import { extractMealPlans, isMealPlanPayload, type MealPlanPayload } from "@/lib/meal-plan-parse";

function outputFromToolPart(part: Record<string, unknown>): unknown {
  return part.output ?? part.result;
}

/** Meal plan from prepareMealPlan tool output only (not tool input / deep scan). */
function extractFromPrepareTool(parts: unknown[]): MealPlanPayload[] {
  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    const record = part as Record<string, unknown>;
    const type = String(record.type ?? "");
    if (!type.includes("prepareMealPlan") && record.toolName !== "prepareMealPlan") {
      continue;
    }
    const output = outputFromToolPart(record);
    if (isMealPlanPayload(output)) {
      return [output];
    }
  }
  return [];
}

/** Text shown to user — stops at prepareMealPlan so follow-up steps are hidden. */
export function getAssistantDisplayText(message: UIMessage): string {
  const chunks: string[] = [];
  for (const part of message.parts ?? []) {
    if (!part || typeof part !== "object") continue;
    const record = part as Record<string, unknown>;
    const type = String(record.type ?? "");
    if (type.includes("prepareMealPlan") || record.toolName === "prepareMealPlan") {
      break;
    }
    if (type === "text" && typeof record.text === "string") {
      chunks.push(record.text);
    }
  }
  return chunks.join("").trim();
}

export function extractMealPlansFromMessage(message: UIMessage): MealPlanPayload[] {
  const fromTool = extractFromPrepareTool(message.parts ?? []);
  if (fromTool.length > 0) return fromTool;

  const displayText = getAssistantDisplayText(message);
  return extractMealPlans(displayText);
}
