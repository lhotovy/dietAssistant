type ChatStep = {
  toolCalls?: Array<{ toolName?: string }>;
  toolResults?: Array<{ toolName?: string; output?: unknown }>;
};

function stepCalledTool(step: ChatStep, name: string): boolean {
  const calls = step.toolCalls;
  return (
    Array.isArray(calls) && calls.some((c) => c?.toolName === name)
  );
}

function isInvalidMealResult(output: unknown): boolean {
  if (!output || typeof output !== "object") return false;
  const result = output as { success?: unknown; invalidMeals?: unknown };
  return result.success === false && Array.isArray(result.invalidMeals) && result.invalidMeals.length > 0;
}

function isSuccessfulPlanResult(output: unknown): boolean {
  if (!output || typeof output !== "object") return false;
  const result = output as { type?: unknown; success?: unknown };
  return result.type === "mealPlan" || (result.type === "mealPlanSaved" && result.success === true);
}

/** Retry only validation failures that include concrete replacement suggestions. */
export function planRepairToolForNextStep({ steps }: { steps: ChatStep[] }): "prepareMealPlan" | "saveMealPlan" | null {
  const latest = steps.at(-1);
  const failure = latest?.toolResults?.find((result) =>
    (result.toolName === "prepareMealPlan" || result.toolName === "saveMealPlan") &&
    isInvalidMealResult(result.output)
  );
  if (!failure) return null;
  const toolName = failure.toolName as "prepareMealPlan" | "saveMealPlan";
  const attempts = steps.flatMap((step) => step.toolResults ?? []).filter((result) => result.toolName === toolName).length;
  return attempts < 3 ? toolName : null;
}

/**
 * Stop after a valid plan. Allow up to two repairs for invalid recipe/meal-type
 * assignments; the UI renders the final tool result. Max 12 total steps.
 */
export function chatStopWhen({ steps }: { steps: ChatStep[] }): boolean {
  if (steps.length >= 12) return true;

  if (steps.some((step) => step.toolResults?.some((result) =>
    (result.toolName === "prepareMealPlan" || result.toolName === "saveMealPlan") &&
    isSuccessfulPlanResult(result.output)
  ))) return true;

  if (planRepairToolForNextStep({ steps })) return false;

  const saveStepIndex = steps.findIndex((s) =>
    stepCalledTool(s, "saveMealPlan")
  );
  if (saveStepIndex >= 0) {
    return steps.length > saveStepIndex + 1;
  }

  const prepareStepIndex = steps.findIndex((s) =>
    stepCalledTool(s, "prepareMealPlan")
  );
  if (prepareStepIndex >= 0) {
    return steps.length > prepareStepIndex + 1;
  }

  return false;
}
