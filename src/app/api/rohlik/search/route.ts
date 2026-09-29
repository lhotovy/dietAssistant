import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callRohlikTool } from "@/lib/rohlik-mcp";
import { extractRohlikProducts } from "@/lib/rohlik-products";
import { getRohlikConnection } from "@/lib/rohlik-oauth";
import { prisma } from "@/lib/prisma";
import { normalizeShoppingListKey } from "@/lib/shopping-list";

export const runtime = "nodejs";

const schema = z.object({
  queries: z.array(z.object({ keyword: z.string().trim().min(2).max(100) })).min(1).max(4),
  ingredientKey: z.string().min(1).max(200).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Zadej 1–4 hledané suroviny." }, { status: 400 });
  const ingredientKey = parsed.data.ingredientKey ? normalizeShoppingListKey(parsed.data.ingredientKey) : null;
  if (parsed.data.ingredientKey && !ingredientKey) return NextResponse.json({ error: "Neplatný klíč suroviny." }, { status: 400 });
  try {
    const result = await callRohlikTool("batch_search_products", {
      queries: parsed.data.queries,
      context: "Uživatel hledá produkty pro nákup surovin do týdenního jídelního plánu.",
    });
    const connection = await getRohlikConnection();
    const preference = connection && ingredientKey ? await prisma.rohlikProductPreference.findUnique({
      where: { connectionId_ingredientKey: { connectionId: connection.id, ingredientKey } },
    }) : null;
    return NextResponse.json({ products: extractRohlikProducts(result), preferredProductId: preference?.productId ?? null });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Vyhledávání Rohlik selhalo." }, { status: 502 });
  }
}
