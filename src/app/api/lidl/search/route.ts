import { NextRequest, NextResponse } from "next/server";
import { searchLidlPrices } from "@/lib/lidl-prices";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 100) {
    return NextResponse.json({ error: "Zadej hledanou surovinu." }, { status: 400 });
  }
  const result = await searchLidlPrices(query);
  return NextResponse.json(result);
}
