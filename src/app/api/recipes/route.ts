import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseRecipe } from "@/lib/recipe-utils";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const recipe = await prisma.recipe.findUnique({ where: { id } });
    if (!recipe)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(parseRecipe(recipe));
  }

  const query = searchParams.get("q") ?? "";
  const mealType = searchParams.get("mealType") ?? "";
  const limitParam = parseInt(searchParams.get("limit") ?? "", 10);
  const take = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 500)
    : mealType || query
      ? 100
      : 200;

  const recipes = await prisma.recipe.findMany({
    where: {
      AND: [
        query
          ? {
              OR: [
                { name: { contains: query } },
                { description: { contains: query } },
                { tags: { contains: query } },
              ],
            }
          : {},
        mealType ? { mealTypes: { contains: mealType } } : {},
      ],
    },
    orderBy: { name: "asc" },
    take,
  });

  return NextResponse.json(recipes.map(parseRecipe));
}
