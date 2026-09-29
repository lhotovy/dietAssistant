import assert from "node:assert/strict";
import test from "node:test";
import { parseLidlOffers, findLidlOffers } from "../src/lib/lidl-prices";
import { priceForNeed } from "../src/lib/package-price";
import { extractRohlikProducts } from "../src/lib/rohlik-products";
import { buildShoppingList, normalizeShoppingListKey, shoppingListItemKey } from "../src/lib/shopping-list";
import { isRelevantProduct } from "../src/lib/product-relevance";
import { selectShoppingChoice } from "../src/lib/shopping-selection";

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

test("shopping keys preserve name and unit without PostgreSQL-invalid NUL", () => {
  const list = buildShoppingList(
    [{ date: "2026-09-29", meals: [{ type: "obed", recipeId: "recipe-1" }] }],
    [{ id: "recipe-1", name: "Lunch", servings: 1, ingredients: [{ name: "Mléko", amount: 1, unit: "l" }] }],
    1
  );
  const key = shoppingListItemKey("Mléko", "ml");
  assert.equal(list.items[0].key, key);
  assert.equal(key.includes("\u0000"), false);
  assert.equal(normalizeShoppingListKey("mléko\u0000ml"), key);
  assert.equal(normalizeShoppingListKey("mléko\u0000ml\u0000extra"), null);
  assert.notEqual(shoppingListItemKey("a,b", "c"), shoppingListItemKey("a", "b,c"));
});

test("potato variants combine into one estimated shopping need", () => {
  const list = buildShoppingList(
    [{ date: "2026-09-29", meals: [
      { type: "obed", recipeId: "plain" },
      { type: "vecere", recipeId: "cooked" },
      { type: "svacina", recipeId: "large" },
    ] }],
    [
      { id: "plain", name: "Plain", servings: 1, ingredients: [{ name: "Brambory", amount: 500, unit: "g" }] },
      { id: "cooked", name: "Cooked", servings: 1, ingredients: [{ name: "Brambory vařené", amount: 300, unit: "g" }] },
      { id: "large", name: "Large", servings: 1, ingredients: [{ name: "Brambory velké", amount: 2, unit: "ks" }] },
    ],
    1
  );
  assert.deepEqual(list.items, [{ key: shoppingListItemKey("Brambory", "g"), name: "Brambory", amount: 1300, unit: "g", estimated: true }]);
});

test("ingredient matching excludes prepared sweet-potato dishes", () => {
  assert.equal(isRelevantProduct("Batáty", "Batáty BIO 1 kg"), true);
  assert.equal(isRelevantProduct("Batáty", "Burger gnocchi s batáty"), false);
  assert.equal(isRelevantProduct("Batáty", "Batátové hranolky"), false);
  assert.equal(isRelevantProduct("Brambory", "Bramborové krokety"), false);
  assert.equal(isRelevantProduct("Mléko", "Kokosové mléko 1 l"), false);
});

test("automatic selection compares package totals and respects a saved brand", () => {
  const item = { key: shoppingListItemKey("Mléko", "ml"), name: "Mléko", amount: 1500, unit: "ml" };
  const cheap = { productId: 1, name: "Mléko levné 1 l", priceCzk: 18, inStock: true, favorite: false };
  const preferred = { productId: 2, name: "Mléko oblíbené 1 l", priceCzk: 30, inStock: true, favorite: false };
  const lidl = { productId: 3, name: "Mléko 1 l", priceCzk: 17, packaging: "1 l", url: "https://www.lidl.cz/p/example", fetchedAt: "", page: "" };
  const offers = { rohlik: [cheap, preferred], lidl: [lidl], preferredProductId: null };
  assert.deepEqual(selectShoppingChoice(item, offers), { store: "lidl", product: lidl, quantity: 2, totalCzk: 34, reason: "price" });
  assert.deepEqual(selectShoppingChoice(item, { ...offers, preferredProductId: 2 }), { store: "rohlik", product: preferred, quantity: 2, totalCzk: 60, reason: "preference" });
  assert.equal(selectShoppingChoice(item, { ...offers, error: "lookup failed" }), null);
});

test("automatic selection leaves unrelated or unmeasurable goods unresolved", () => {
  const item = { key: shoppingListItemKey("Batáty", "g"), name: "Batáty", amount: 500, unit: "g" };
  const rohlik = { productId: 1, name: "Burger gnocchi s batáty 500 g", priceCzk: 40, inStock: true, favorite: false };
  const lidl = { productId: 2, name: "Batáty", priceCzk: 30, packaging: "", url: "https://www.lidl.cz/p/example", fetchedAt: "", page: "" };
  assert.equal(selectShoppingChoice(item, { rohlik: [rohlik], lidl: [lidl], preferredProductId: null }), null);
});
