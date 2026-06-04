import type { UIMessage } from "ai";
import {
  extractMealPlans,
  normalizeMealPlanPayload,
  type MealPlanPayload,
} from "@/lib/meal-plan-parse";

export interface AssistantSavedMealPlan {
  planId: string;
  plan: MealPlanPayload;
}

function unwrapToolPayload(raw: unknown): unknown {
  if (raw == null) return raw;
  if (typeof raw === "string") {
    try {
      return unwrapToolPayload(JSON.parse(raw));
    } catch {
      return raw;
    }
  }
  if (typeof raw !== "object") return raw;
  const o = raw as Record<string, unknown>;
  if (o.type === "mealPlan" || o.type === "mealPlanSaved" || Array.isArray(o.days)) {
    return o;
  }
  if ("value" in o) return unwrapToolPayload(o.value);
  if ("result" in o) return unwrapToolPayload(o.result);
  if ("data" in o) return unwrapToolPayload(o.data);
  return o;
}

function outputFromToolPart(part: Record<string, unknown>): unknown {
  return unwrapToolPayload(part.output ?? part.result);
}

function isPrepareMealPlanPart(record: Record<string, unknown>): boolean {
  const type = String(record.type ?? "");
  return (
    type === "tool-prepareMealPlan" ||
    type.includes("prepareMealPlan") ||
    (type === "dynamic-tool" && record.toolName === "prepareMealPlan")
  );
}

function isSaveMealPlanPart(record: Record<string, unknown>): boolean {
  const type = String(record.type ?? "");
  return (
    type === "tool-saveMealPlan" ||
    type.includes("saveMealPlan") ||
    (type === "dynamic-tool" && record.toolName === "saveMealPlan")
  );
}

function isMealPlanToolPart(record: Record<string, unknown>): boolean {
  return isPrepareMealPlanPart(record) || isSaveMealPlanPart(record);
}

function planFromToolPart(record: Record<string, unknown>): MealPlanPayload | null {
  const state = record.state;
  if (state === "output-error") return null;

  if (state === "output-available" || state === "output-complete") {
    const fromOutput = normalizeMealPlanPayload(outputFromToolPart(record));
    if (fromOutput) return fromOutput;
    return null;
  }

  if (
    state === "input-streaming" ||
    state === "input-available" ||
    state === "approval-requested"
  ) {
    return null;
  }

  const fromOutput = normalizeMealPlanPayload(outputFromToolPart(record));
  if (fromOutput) return fromOutput;

  const fromInput = normalizeMealPlanPayload(
    unwrapToolPayload(record.input)
  );
  if (fromInput) return fromInput;

  return null;
}

function parseSavedMealPlanResult(output: unknown): AssistantSavedMealPlan | null {
  if (!output || typeof output !== "object") return null;
  const o = output as Record<string, unknown>;
  if (o.success !== true || o.type !== "mealPlanSaved") return null;
  if (typeof o.planId !== "string" || o.planId.length === 0) return null;

  const plan = normalizeMealPlanPayload(o);
  if (!plan) return null;

  return { planId: o.planId, plan };
}

/** Last successful saveMealPlan (plan persisted by the assistant). */
export function extractAssistantSavedMealPlan(
  message: UIMessage
): AssistantSavedMealPlan | null {
  let last: AssistantSavedMealPlan | null = null;

  for (const part of message.parts ?? []) {
    if (!part || typeof part !== "object") continue;
    const record = part as Record<string, unknown>;
    if (!isSaveMealPlanPart(record)) continue;

    const saved = parseSavedMealPlanResult(outputFromToolPart(record));
    if (saved) last = saved;
  }

  return last;
}

/** Plans from prepareMealPlan for the manual save button (not when already saved in-message). */
export function extractPreparedMealPlans(message: UIMessage): MealPlanPayload[] {
  if (extractAssistantSavedMealPlan(message)) return [];

  let lastPlan: MealPlanPayload | null = null;

  for (const part of message.parts ?? []) {
    if (!part || typeof part !== "object") continue;
    const record = part as Record<string, unknown>;
    if (!isPrepareMealPlanPart(record)) continue;

    const plan = planFromToolPart(record);
    if (plan) lastPlan = plan;
  }

  return lastPlan ? [lastPlan] : [];
}

/** @deprecated Use extractPreparedMealPlans */
export function extractMealPlansFromMessage(message: UIMessage): MealPlanPayload[] {
  const prepared = extractPreparedMealPlans(message);
  if (prepared.length > 0) return prepared;

  const displayText = getAssistantDisplayText(message);
  return extractMealPlans(displayText);
}

/** All assistant text parts (including text after a plan update tool call). */
export function getAssistantDisplayText(message: UIMessage): string {
  const chunks: string[] = [];
  for (const part of message.parts ?? []) {
    if (!part || typeof part !== "object") continue;
    const record = part as Record<string, unknown>;
    const type = String(record.type ?? "");
    if (type === "text" && typeof record.text === "string" && record.text.trim()) {
      chunks.push(record.text);
    }
  }
  return chunks.join("\n\n").trim();
}

export function extractPrepareMealPlanError(message: UIMessage): string | null {
  return extractMealPlanToolError(message);
}

export function extractMealPlanToolError(message: UIMessage): string | null {
  let lastError: string | null = null;

  for (const part of message.parts ?? []) {
    if (!part || typeof part !== "object") continue;
    const record = part as Record<string, unknown>;
    if (!isMealPlanToolPart(record)) continue;

    if (record.state === "output-error" && typeof record.errorText === "string") {
      lastError = record.errorText;
      continue;
    }

    const output = outputFromToolPart(record);
    if (
      output &&
      typeof output === "object" &&
      (output as { success?: boolean }).success === false
    ) {
      const o = output as { error?: string; invalidRecipeIds?: string[] };
      const err = typeof o.error === "string" ? o.error : "Plán se nepodařilo zpracovat.";
      const ids =
        Array.isArray(o.invalidRecipeIds) && o.invalidRecipeIds.length > 0
          ? ` (${o.invalidRecipeIds.join(", ")})`
          : "";
      lastError = `${err}${ids}`;
    }
  }

  return lastError;
}
