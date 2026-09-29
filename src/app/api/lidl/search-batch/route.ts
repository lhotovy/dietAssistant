import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchLidlPricesBatch } from "@/lib/lidl-prices";
import { isRelevantProduct } from "@/lib/product-relevance";

export const runtime = "nodejs";

const schema = z.object({ items: z.array(z.object({ key: z.string().min(1).max(200), name: z.string().trim().min(2).max(100) })).min(1).max(100) });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Neplatný seznam surovin." }, { status: 400 });
  try {
    const result = await searchLidlPricesBatch(parsed.data.items.map((item) => item.name));
    return NextResponse.json({
      items: parsed.data.items.map((item, index) => ({ key: item.key, offers: result.offers[index].filter((offer) => isRelevantProduct(item.name, offer.name)) })),
      errors: result.errors,
      sources: result.sources,
    });
  } catch {
    return NextResponse.json({ error: "Lidl ceny se nepodařilo načíst." }, { status: 502 });
  }
}
