"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ShoppingListItem } from "@/lib/shopping-list";
import type { LidlOffer } from "@/lib/lidl-prices";
import type { RohlikProduct } from "@/lib/rohlik-products";
import { priceForNeed } from "@/lib/package-price";
import { selectShoppingChoice, type ShoppingChoice, type ShoppingOffers } from "@/lib/shopping-selection";

type BatchItem = { key: string; offers?: LidlOffer[]; products?: RohlikProduct[]; preferredProductId?: number | null };

export function ShoppingAssistantPanel({ items, planId, planVersion, servings }: {
  items: ShoppingListItem[]; planId: string; planVersion: string; servings: number;
}) {
  const [connection, setConnection] = useState<{ configured: boolean; connected: boolean } | null>(null);
  const [offers, setOffers] = useState<Record<string, ShoppingOffers>>({});
  const [choices, setChoices] = useState<Record<string, ShoppingChoice>>({});
  const [skipped, setSkipped] = useState<string[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [lidlErrors, setLidlErrors] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cartBusy, setCartBusy] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);
  const cartKey = `rohlik-cart:${planId}:${planVersion}:${servings}`;

  useEffect(() => {
    const refresh = () => {
      fetch("/api/rohlik/connection").then((response) => response.json())
        .then((value) => setConnection(value))
        .catch(() => setConnection({ configured: false, connected: false }));
    };
    refresh();
    window.addEventListener("rohlik-connection-changed", refresh);
    return () => window.removeEventListener("rohlik-connection-changed", refresh);
  }, []);

  useEffect(() => {
    if (!connection) return;
    let cancelled = false;
    async function load() {
      setProgress(0);
      setError(null);
      setOffers({});
      setChoices({});
      setSkipped([]);
      setCartAdded(window.localStorage.getItem(cartKey) === "added");
      const next: Record<string, ShoppingOffers> = Object.fromEntries(items.map((item) =>
        [item.key, { rohlik: [], lidl: [], preferredProductId: null }]));
      try {
        const response = await fetch("/api/lidl/search-batch", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: items.map(({ key, name }) => ({ key, name })) }),
        });
        const result = await response.json() as { items?: BatchItem[]; errors?: number; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Lidl ceny se nepodařilo načíst.");
        for (const row of result.items ?? []) if (next[row.key]) next[row.key].lidl = row.offers ?? [];
        if (!cancelled) setLidlErrors(result.errors ?? 0);
      } catch (cause) {
        for (const item of items) next[item.key].error = "Lidl ceny se nepodařilo načíst.";
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Lidl ceny se nepodařilo načíst.");
      }
      if (connection?.connected) {
        for (let start = 0; start < items.length; start += 4) {
          if (cancelled) return;
          const batch = items.slice(start, start + 4);
          try {
            const response = await fetch("/api/rohlik/search-batch", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ items: batch.map(({ key, name }) => ({ key, name })) }),
            });
            const result = await response.json() as { items?: BatchItem[]; error?: string };
            if (!response.ok) throw new Error(result.error ?? "Rohlík hledání selhalo.");
            for (const row of result.items ?? []) {
              if (!next[row.key]) continue;
              next[row.key].rohlik = row.products ?? [];
              next[row.key].preferredProductId = row.preferredProductId ?? null;
            }
          } catch (cause) {
            for (const item of batch) next[item.key].error = cause instanceof Error ? cause.message : "Rohlík hledání selhalo.";
          }
          if (!cancelled) setProgress(Math.min(start + 4, items.length));
        }
      }
      if (!cancelled) {
        setOffers(next);
        setChoices(Object.fromEntries(items.flatMap((item) => {
          const choice = connection?.connected ? selectShoppingChoice(item, next[item.key]) : null;
          return choice ? [[item.key, choice]] : [];
        })));
        setProgress(null);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [connection?.connected, connection?.configured, cartKey, items]);

  function choose(item: ShoppingListItem, store: "rohlik" | "lidl", product: RohlikProduct | LidlOffer) {
    const cost = priceForNeed(product.priceCzk, store === "rohlik" ? product.name : (product as LidlOffer).packaging, item.amount, item.unit);
    if (!cost || cost.packages > 100) return;
    const choice: ShoppingChoice = store === "rohlik"
      ? { store, product: product as RohlikProduct, quantity: cost.packages, totalCzk: cost.totalCzk, reason: "price", manual: true }
      : { store, product: product as LidlOffer, quantity: cost.packages, totalCzk: cost.totalCzk, reason: "price", manual: true };
    setChoices((current) => ({ ...current, [item.key]: choice }));
    setSkipped((current) => current.filter((key) => key !== item.key));
  }

  function skip(item: ShoppingListItem) {
    setChoices((current) => {
      const next = { ...current };
      delete next[item.key];
      return next;
    });
    setSkipped((current) => [...new Set([...current, item.key])]);
  }

  const rohlikChoices = items.flatMap((item) => choices[item.key]?.store === "rohlik"
    ? [{ item, choice: choices[item.key] as Extract<ShoppingChoice, { store: "rohlik" }> }] : []);
  const lidlChoices = items.flatMap((item) => choices[item.key]?.store === "lidl"
    ? [{ item, choice: choices[item.key] as Extract<ShoppingChoice, { store: "lidl" }> }] : []);
  const unresolved = items.length - rohlikChoices.length - lidlChoices.length - skipped.length;

  async function addToCart() {
    if (cartBusy || cartAdded || progress !== null || !rohlikChoices.length) return;
    setCartBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/rohlik/cart", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: rohlikChoices.map(({ item, choice }) => ({
          ingredientKey: item.key, productId: choice.product.productId,
          productName: choice.product.name, quantity: choice.quantity,
          rememberPreference: choice.manual === true,
        })) }),
      });
      const result = await response.json() as { success?: boolean; error?: string; message?: string };
      if (!response.ok || result.success === false) throw new Error(result.error ?? result.message ?? "Produkty se nepodařilo přidat.");
      window.localStorage.setItem(cartKey, "added");
      setCartAdded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Vložení do košíku selhalo.");
    } finally {
      setCartBusy(false);
    }
  }

  function copyLidlList() {
    const text = lidlChoices.map(({ item, choice }) => `${choice.quantity}× ${choice.product.name} (${choice.product.packaging}) – ${item.name}: ${item.amount} ${item.unit}\n${choice.product.url}`).join("\n");
    void navigator.clipboard.writeText(text).catch(() => setError("Seznam se nepodařilo zkopírovat."));
  }

  return <div className="mt-5 border-t border-stone-200 pt-4 space-y-3">
    <h4 className="text-sm font-semibold text-stone-800">Porovnání Rohlík a Lidl</h4>
    {!connection ? <p className="text-xs text-stone-500">Ověřuji připojení…</p> :
      !connection.configured ? <p className="text-xs text-amber-700">Pro připojení Rohlík nastav ROHLIK_TOKEN_ENCRYPTION_KEY na serveru.</p> :
        !connection.connected ? <p className="text-xs text-amber-700">Připoj Rohlík účet, aby šlo porovnat oba obchody.</p> : null}
    {progress !== null && <p role="status" className="text-xs text-stone-600">Porovnávám suroviny… {progress}/{items.length}</p>}
    {progress === null && <p className="text-xs text-stone-600">Vybráno: {rohlikChoices.length} Rohlík, {lidlChoices.length} Lidl, {unresolved} k ruční kontrole.</p>}
    <p className="text-xs text-stone-500">Ceny Lidlu pocházejí jen ze sledovaných veřejných stránek. Chybějící nabídka neznamená, že Lidl produkt neprodává. Balení bez ověřitelné velikosti zůstane k ruční kontrole.</p>
    {lidlErrors > 0 && <p className="text-xs text-amber-700">Některé stránky Lidlu se nepodařilo načíst.</p>}
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    {progress === null && <ul className="space-y-3">{items.map((item) => {
      const result = offers[item.key];
      const choice = choices[item.key];
      return <li key={item.key} className="rounded-xl border border-stone-200 bg-white p-3 space-y-2">
        <p className="text-sm font-medium text-stone-800">{item.name} · {item.amount} {item.unit}</p>
        {choice ? <p className="text-xs text-green-800">{choice.store === "rohlik" ? "Rohlík" : "Lidl"}: {choice.quantity}× {choice.product.name} · {formatCzk(choice.totalCzk)}{choice.reason === "preference" ? " · dříve zvolená značka" : choice.reason === "favorite" ? " · oblíbený produkt" : " · nejnižší ověřená cena"}</p>
          : skipped.includes(item.key) ? <p className="text-xs text-stone-500">Přeskočeno</p>
          : <p className="text-xs text-amber-700">Bez bezpečně porovnatelné nabídky – zkontroluj ručně.</p>}
        <button type="button" className="text-xs underline text-stone-500" onClick={() => skip(item)}>Přeskočit</button>
        {result?.error && <p className="text-xs text-amber-700">{result.error}</p>}
        {result && <details className="text-xs text-stone-700"><summary className="cursor-pointer">Zobrazit nabídky a změnit výběr</summary>
          <div className="grid gap-2 sm:grid-cols-2 mt-2">
            <div><p className="font-semibold mb-1">Rohlík</p>{result.rohlik.map((product) => {
              const cost = priceForNeed(product.priceCzk, product.name, item.amount, item.unit);
              return <button key={product.productId} type="button" disabled={!cost || cost.packages > 100} onClick={() => choose(item, "rohlik", product)} className="block w-full text-left border rounded-lg p-2 mb-1 disabled:opacity-50">{product.name} · {cost ? `${cost.packages}× ${formatCzk(cost.totalCzk)}` : "neznámé balení"}{product.favorite ? " ★" : ""}</button>;
            })}{!result.rohlik.length && <p>Nenalezeno</p>}</div>
            <div><p className="font-semibold mb-1">Lidl</p>{result.lidl.map((product) => {
              const cost = priceForNeed(product.priceCzk, product.packaging, item.amount, item.unit);
              return <button key={product.productId} type="button" disabled={!cost || cost.packages > 100} onClick={() => choose(item, "lidl", product)} className="block w-full text-left border rounded-lg p-2 mb-1 disabled:opacity-50">{product.name} · {product.packaging} · {cost ? `${cost.packages}× ${formatCzk(cost.totalCzk)}` : "neznámé balení"}</button>;
            })}{!result.lidl.length && <p>Na sledovaných stránkách nenalezeno</p>}</div>
          </div></details>}
      </li>;
    })}</ul>}
    {progress === null && <div className="flex flex-wrap gap-2 items-center">
      <Button type="button" size="sm" disabled={!connection?.connected || !rohlikChoices.length || rohlikChoices.length > 50 || cartBusy || cartAdded} onClick={() => void addToCart()}>{cartBusy ? "Přidávám…" : cartAdded ? "Přidáno do košíku" : `Přidat ${rohlikChoices.length} položek do košíku Rohlík`}</Button>
      <Button type="button" size="sm" variant="secondary" disabled={!lidlChoices.length} onClick={copyLidlList}>Kopírovat seznam Lidl ({lidlChoices.length})</Button>
    </div>}
    {rohlikChoices.length > 50 && <p className="text-xs text-amber-700">Rohlík přijímá nejvýše 50 položek najednou. Zkrať seznam před vložením.</p>}
    {cartAdded && <p role="status" className="text-xs text-green-700">Produkty byly pro tento plán přidány do košíku Rohlík. Před dalším vložením zkontroluj košík.</p>}
    {lidlChoices.length > 0 && <ul className="text-xs text-stone-700 space-y-1">{lidlChoices.map(({ item, choice }) => <li key={item.key}>{choice.quantity}× <a href={choice.product.url} target="_blank" rel="noopener noreferrer" className="underline">{choice.product.name}</a> · {formatCzk(choice.totalCzk)}</li>)}</ul>}
  </div>;
}

function formatCzk(price: number) {
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK" }).format(price);
}
