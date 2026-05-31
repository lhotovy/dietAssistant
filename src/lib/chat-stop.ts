import { stepCountIs } from "ai";

function stepCalledPrepareMealPlan(step: {
  toolCalls?: Array<{ toolName?: string }>;
}): boolean {
  const calls = step.toolCalls;
  return (
    Array.isArray(calls) &&
    calls.some((c) => c?.toolName === "prepareMealPlan")
  );
}

/**
 * Stop after prepareMealPlan ran (text + tool call, then tool result),
 * before the model can add another “saving…” message. Max 6 steps as safety.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function chatStopWhen({ steps }: { steps: any[] }): boolean {
  if (stepCountIs(6)({ steps })) return true;

  const prepareStepIndex = steps.findIndex(stepCalledPrepareMealPlan);
  if (prepareStepIndex < 0) return false;

  return steps.length > prepareStepIndex + 1;
}
