import { NextResponse } from "next/server";
import { getPlanningCatalogForUser } from "@/lib/planning-catalog";
import { getUserId } from "@/lib/user";

export async function GET() {
  const userId = await getUserId();
  const catalog = await getPlanningCatalogForUser(userId);

  return NextResponse.json({
    version: catalog.version,
    recipes: catalog.recipes,
    fetchedAt: catalog.fetchedAt,
  });
}
