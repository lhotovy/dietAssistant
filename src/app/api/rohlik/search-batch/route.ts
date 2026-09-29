import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callRohlikTool } from "@/lib/rohlik-mcp";
import { extractRohlikProducts } from "@/lib/rohlik-products";
import { getRohlikConnection } from "@/lib/rohlik-oauth";
import { normalizeShoppingListKey } from "@/lib/shopping-list";
import { isRelevantProduct } from "@/lib/product-relevance";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const schema = z.object({ items: z.array(z.object({ key: z.string().min(1).max(200), name: z.string().trim().min(2).max(100) })).min(1).max(4) });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Zadej 1–4 suroviny." }, { status: 400 });
  const items = parsed.data.items.map((item) => ({ ...item, key: normalizeShoppingListKey(item.key) }));
  if (items.some((item) => !item.key)) return NextResponse.json({ error: "Neplatný klíč suroviny." }, { status: 400 });
  try {
    const result = await callRohlikTool("batch_search_products", {
      queries: items.map((item) => ({ keyword: item.name })),
      context: "Uživatel porovnává produkty pro suroviny týdenního jídelního plánu.",
    });
    const connection = await getRohlikConnection();
    const preferences = connection ? await prisma.rohlikProductPreference.findMany({
      where: { connectionId: connection.id, ingredientKey: { in: items.map((item) => item.key!) } },
      select: { ingredientKey: true, productId: true },
    }) : [];
    const preferredByKey = new Map(preferences.map((preference) => [preference.ingredientKey, preference.productId]));
    const products = extractRohlikProducts(result);
    return NextResponse.json({ items: items.map((item) => ({
      key: item.key,
      products: products.filter((product) => product.inStock && isRelevantProduct(item.name, product.name)),
      preferredProductId: preferredByKey.get(item.key!) ?? null,
    })) });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Vyhledávání Rohlik selhalo." }, { status: 502 });
  }
}
