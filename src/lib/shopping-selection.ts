import type { ShoppingListItem } from "@/lib/shopping-list";
import type { RohlikProduct } from "@/lib/rohlik-products";
import type { LidlOffer } from "@/lib/lidl-prices";
import { priceForNeed } from "@/lib/package-price";
import { isRelevantProduct } from "@/lib/product-relevance";

export type ShoppingChoice =
  | { store: "rohlik"; product: RohlikProduct; quantity: number; totalCzk: number; reason: "preference" | "favorite" | "price"; manual?: boolean }
  | { store: "lidl"; product: LidlOffer; quantity: number; totalCzk: number; reason: "price"; manual?: boolean };

export type ShoppingOffers = { rohlik: RohlikProduct[]; lidl: LidlOffer[]; preferredProductId: number | null; error?: string };

export function selectShoppingChoice(item: ShoppingListItem, offers: ShoppingOffers): ShoppingChoice | null {
  if (offers.error) return null;
  const rohlik = offers.rohlik.flatMap((product) => {
    if (!product.inStock || !isRelevantProduct(item.name, product.name)) return [];
    const cost = priceForNeed(product.priceCzk, product.name, item.amount, item.unit);
    return cost && cost.packages <= 100 ? [{ product, ...cost }] : [];
  }).sort((a, b) => a.totalCzk - b.totalCzk);
  const lidl = offers.lidl.flatMap((product) => {
    if (!isRelevantProduct(item.name, product.name)) return [];
    const cost = priceForNeed(product.priceCzk, product.packaging, item.amount, item.unit);
    return cost && cost.packages <= 100 ? [{ product, ...cost }] : [];
  }).sort((a, b) => a.totalCzk - b.totalCzk);

  const preferred = rohlik.find(({ product }) => product.productId === offers.preferredProductId)
    ?? rohlik.find(({ product }) => product.favorite);
  if (preferred) return { store: "rohlik", product: preferred.product, quantity: preferred.packages,
    totalCzk: preferred.totalCzk, reason: preferred.product.productId === offers.preferredProductId ? "preference" : "favorite" };
  if (lidl[0] && (!rohlik[0] || lidl[0].totalCzk < rohlik[0].totalCzk)) {
    return { store: "lidl", product: lidl[0].product, quantity: lidl[0].packages, totalCzk: lidl[0].totalCzk, reason: "price" };
  }
  if (rohlik[0]) return { store: "rohlik", product: rohlik[0].product, quantity: rohlik[0].packages, totalCzk: rohlik[0].totalCzk, reason: "price" };
  return null;
}
