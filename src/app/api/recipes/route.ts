import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseRecipe } from "@/lib/recipe-utils";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") ?? "";
  const mealType = searchParams.get("mealType") ?? "";

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
    take: 20,
  });

  return NextResponse.json(recipes.map(parseRecipe));
}
