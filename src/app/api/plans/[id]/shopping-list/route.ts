import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/user";
import { buildShoppingList } from "@/lib/shopping-list";
import type { MealPlanDay, RecipeIngredient } from "@/types";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const servings = Number(req.nextUrl.searchParams.get("servings") ?? "1");
  if (!Number.isInteger(servings) || servings < 1 || servings > 12) {
    return NextResponse.json({ error: "Počet porcí musí být od 1 do 12." }, { status: 400 });
  }

  const userId = await getUserId();
  const plan = await prisma.mealPlan.findFirst({ where: { id, userId } });
  if (!plan) {
    return NextResponse.json({ error: "Plán nenalezen." }, { status: 404 });
  }

  const days = JSON.parse(plan.days) as MealPlanDay[];
  const recipeIds = [...new Set(days.flatMap((day) => day.meals.map((meal) => meal.recipeId).filter((id): id is string => Boolean(id))))];
  const rows = await prisma.recipe.findMany({
    where: { id: { in: recipeIds } },
    select: { id: true, name: true, servings: true, ingredients: true },
  });
  const recipes = rows.map((row) => ({
    ...row,
    ingredients: JSON.parse(row.ingredients) as RecipeIngredient[],
  }));

  return NextResponse.json({
    planId: plan.id,
    planUpdatedAt: plan.updatedAt,
    servingsPerMeal: servings,
    ...buildShoppingList(days, recipes, servings),
  });
}
