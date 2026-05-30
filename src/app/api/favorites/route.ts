import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/user";
import { parseRecipe } from "@/lib/recipe-utils";
import type { RecipeIngredient } from "@/types";

export async function GET() {
  const userId = await getUserId();
  const favorites = await prisma.favorite.findMany({
    where: { userId },
    include: { recipe: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    favorites.map((f) => ({
      id: f.id,
      userId: f.userId,
      recipeId: f.recipeId,
      recipe: f.recipe ? parseRecipe(f.recipe) : null,
      customName: f.customName,
      customIngredients: f.customIngredients
        ? (JSON.parse(f.customIngredients) as RecipeIngredient[])
        : null,
      customInstructions: f.customInstructions
        ? (JSON.parse(f.customInstructions) as string[])
        : null,
      notes: f.notes,
      createdAt: f.createdAt,
    }))
  );
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  const { id } = await req.json();

  await prisma.favorite.deleteMany({ where: { id, userId } });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId();
  const { id, customName, customIngredients, customInstructions, notes } =
    await req.json();

  const updated = await prisma.favorite.updateMany({
    where: { id, userId },
    data: {
      customName: customName ?? undefined,
      customIngredients: customIngredients
        ? JSON.stringify(customIngredients)
        : undefined,
      customInstructions: customInstructions
        ? JSON.stringify(customInstructions)
        : undefined,
      notes: notes ?? undefined,
    },
  });

  return NextResponse.json({ success: true, count: updated.count });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  const { recipeId, name, notes, ingredients, instructions } = await req.json();

  const favorite = await prisma.favorite.create({
    data: {
      userId,
      recipeId: recipeId ?? null,
      customName: recipeId ? null : name,
      customIngredients: ingredients ? JSON.stringify(ingredients) : null,
      customInstructions: instructions ? JSON.stringify(instructions) : null,
      notes: notes ?? null,
    },
  });
  return NextResponse.json({ success: true, favoriteId: favorite.id });
}
