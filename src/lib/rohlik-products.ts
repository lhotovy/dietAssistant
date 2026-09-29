export type RohlikProduct = {
  productId: number;
  name: string;
  priceCzk: number;
  inStock: boolean;
  favorite: boolean;
};

export function extractRohlikProducts(value: unknown): RohlikProduct[] {
  const found = new Map<number, RohlikProduct>();
  function visit(node: unknown, depth: number) {
    if (depth > 8 || !node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, depth + 1));
      return;
    }
    const object = node as Record<string, unknown>;
    const id = Number(object.productId ?? object.product_id ?? object.id);
    const name = object.productName ?? object.product_name ?? object.name;
    const priceObject = object.price;
    const price = typeof priceObject === "object" && priceObject !== null
      ? Number((priceObject as Record<string, unknown>).price ?? (priceObject as Record<string, unknown>).amount)
      : Number(priceObject);
    if (Number.isInteger(id) && id > 0 && typeof name === "string" && Number.isFinite(price) && price >= 0) {
      found.set(id, {
        productId: id,
        name,
        priceCzk: price,
        inStock: object.inStock !== false && object.in_stock !== false,
        favorite: object.favourite === true || object.favorite === true || object.isFavorite === true,
      });
    }
    Object.values(object).forEach((nested) => visit(nested, depth + 1));
  }
  visit(value, 0);
  return [...found.values()];
}
