import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callRohlikTool } from "@/lib/rohlik-mcp";
import { getRohlikConnection } from "@/lib/rohlik-oauth";
import { prisma } from "@/lib/prisma";
import { normalizeShoppingListKey } from "@/lib/shopping-list";

export const runtime = "nodejs";

const schema = z.object({
  items: z.array(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(100),
    ingredientKey: z.string().min(1).max(200),
    productName: z.string().min(1).max(200),
    rememberPreference: z.boolean().default(true),
  })).min(1).max(50),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Neplatné produkty nebo množství." }, { status: 400 });
  const items = parsed.data.items.map((item) => ({ ...item, ingredientKey: normalizeShoppingListKey(item.ingredientKey) ?? "" }));
  if (items.some((item) => !item.ingredientKey)) return NextResponse.json({ error: "Neplatný klíč suroviny." }, { status: 400 });
  try {
    const connection = await getRohlikConnection();
    if (!connection) return NextResponse.json({ error: "Nejdříve připoj účet Rohlik." }, { status: 401 });
    const result = await callRohlikTool("add_items_to_cart", {
      items: parsed.data.items.map(({ productId, quantity }) => ({ productId, quantity })),
      context: "Uživatel přidává schválené produkty pro týdenní jídelní plán do košíku.",
    });
    if (result && typeof result === "object" && "success" in result && result.success === false) {
      return NextResponse.json({ error: "Rohlik produkty nepřidal do košíku.", result }, { status: 502 });
    }
    const rememberedItems = items.filter((item) => item.rememberPreference);
    if (rememberedItems.length) {
      try {
        await prisma.$transaction(rememberedItems.map((item) => prisma.rohlikProductPreference.upsert({
          where: { connectionId_ingredientKey: { connectionId: connection.id, ingredientKey: item.ingredientKey } },
          create: { connectionId: connection.id, ingredientKey: item.ingredientKey, productId: item.productId, productName: item.productName },
          update: { productId: item.productId, productName: item.productName, chosenCount: { increment: 1 } },
        })));
      } catch {
        // The cart mutation already succeeded. Do not invite a retry that duplicates items.
      }
    }
    return NextResponse.json(result);
  } catch (cause) {
    return NextResponse.json({ error: `${cause instanceof Error ? cause.message : "Vložení do košíku selhalo."} Před opakováním zkontroluj košík Rohlik.` }, { status: 502 });
  }
}
