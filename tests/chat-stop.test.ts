import assert from "node:assert/strict";
import test from "node:test";
import { chatStopWhen, planRepairToolForNextStep } from "../src/lib/chat-stop";

const invalidMeal = { success: false, invalidMeals: [{ mealType: "vecere", suggestions: ["valid-dinner-id | Večeře"] }] };
const failedPrepare = { toolCalls: [{ toolName: "prepareMealPlan" }], toolResults: [{ toolName: "prepareMealPlan", output: invalidMeal }] };

test("retries an invalid meal assignment using the same plan tool", () => {
  assert.equal(planRepairToolForNextStep({ steps: [failedPrepare] }), "prepareMealPlan");
  assert.equal(chatStopWhen({ steps: [failedPrepare] }), false);
  const repaired = { toolCalls: [{ toolName: "prepareMealPlan" }], toolResults: [{ toolName: "prepareMealPlan", output: { type: "mealPlan", days: [] } }] };
  assert.equal(chatStopWhen({ steps: [failedPrepare, repaired] }), true);
});

test("stops after three invalid meal assignments", () => {
  const steps = [failedPrepare, failedPrepare, failedPrepare];
  assert.equal(planRepairToolForNextStep({ steps }), null);
  assert.equal(chatStopWhen({ steps }), true);
});

test("does not retry other plan validation failures", () => {
  const failed = { toolCalls: [{ toolName: "prepareMealPlan" }], toolResults: [{ toolName: "prepareMealPlan", output: { success: false, error: "nutrition unavailable" } }] };
  assert.equal(planRepairToolForNextStep({ steps: [failed] }), null);
});
