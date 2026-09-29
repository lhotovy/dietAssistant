import assert from "node:assert/strict";
import test from "node:test";
import { parseLidlOffers, findLidlOffers } from "../src/lib/lidl-prices";
import { priceForNeed } from "../src/lib/package-price";
import { extractRohlikProducts } from "../src/lib/rohlik-products";

test("Lidl card parser reads priced store products", () => {
  const product = JSON.stringify({ productId: 123, title: "Trvanlivé mléko 1,5%", price: { price: 12.9, packaging: { text: "1 l" } }, canonicalUrl: "/p/mleko/p123", store: true });
  const html = '<div data-grid-data="' + product.replaceAll('"', '&quot;') + '"></div>';
  const offers = parseLidlOffers(html, "https://www.lidl.cz/c/example", "2026-09-29T00:00:00Z");
  assert.equal(offers.length, 1);
  assert.equal(offers[0].priceCzk, 12.9);
  assert.equal(findLidlOffers(offers, "mleko")[0].productId, 123);
});

test("package quantities use matching units and round up", () => {
  assert.deepEqual(priceForNeed(19.9, "Mléko 1 l", 1500, "ml"), { packages: 2, totalCzk: 39.8 });
  assert.deepEqual(priceForNeed(49.9, "500 g", 600, "g"), { packages: 2, totalCzk: 99.8 });
  assert.equal(priceForNeed(19.9, "1 l", 500, "g"), null);
});

test("Rohlik result parser extracts product candidates", () => {
  assert.deepEqual(extractRohlikProducts({ data: [{ productId: 123, productName: "Mléko", price: 19.9, inStock: true, favourite: true }] }), [
    { productId: 123, name: "Mléko", priceCzk: 19.9, inStock: true, favorite: true },
  ]);
});
