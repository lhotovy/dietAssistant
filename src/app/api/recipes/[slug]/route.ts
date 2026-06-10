import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseRecipe } from "@/lib/recipe-utils";
import { getUserId } from "@/lib/user";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const recipe = await prisma.recipe.findUnique({ where: { slug } });
  if (!recipe) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(parseRecipe(recipe));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  await getUserId();
  const { slug } = await params;
  const recipe = await prisma.recipe.findUnique({ where: { slug } });
  if (!recipe) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.recipe.delete({ where: { slug } });
  return NextResponse.json({ success: true });
}
