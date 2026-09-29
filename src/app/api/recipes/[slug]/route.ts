import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseRecipe } from "@/lib/recipe-utils";
import { getUserId } from "@/lib/user";
import { z } from "zod";

const nutritionSchema = z.object({
  sugarsPerServing: z.number().finite().min(0).max(1000).nullable(),
  proteinPerServing: z.number().finite().min(0).max(1000).nullable(),
  nutritionSource: z.string().trim().max(250).nullable(),
}).refine((value) =>
  (value.sugarsPerServing == null && value.proteinPerServing == null) ||
  Boolean(value.nutritionSource && value.nutritionSource.length >= 3),
  { message: "Uveď zdroj výživových hodnot." }
);

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  await getUserId();
  const parsed = nutritionSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neplatné údaje." }, { status: 400 });
  }
  const { slug } = await params;
  const recipe = await prisma.recipe.findUnique({ where: { slug } });
  if (!recipe) return NextResponse.json({ error: "Recept nenalezen." }, { status: 404 });
  const updated = await prisma.recipe.update({
    where: { slug },
    data: parsed.data,
  });
  return NextResponse.json(parseRecipe(updated));
}
