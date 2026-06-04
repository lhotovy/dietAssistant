import { stepCountIs } from "ai";

function stepCalledTool(step: { toolCalls?: Array<{ toolName?: string }> }, name: string): boolean {
  const calls = step.toolCalls;
  return (
    Array.isArray(calls) && calls.some((c) => c?.toolName === name)
  );
}

/**
 * Stop right after prepareMealPlan (UI renders plan from tool output; no extra LLM pass).
 * After saveMealPlan: allow one short follow-up step. Max 12 steps for search + plan tools.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function chatStopWhen({ steps }: { steps: any[] }): boolean {
  if (stepCountIs(12)({ steps })) return true;

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
