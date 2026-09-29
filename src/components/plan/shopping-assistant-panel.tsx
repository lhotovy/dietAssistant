"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ShoppingListItem } from "@/lib/shopping-list";
import type { LidlOffer } from "@/lib/lidl-prices";
import type { RohlikProduct } from "@/lib/rohlik-products";
import { priceForNeed } from "@/lib/package-price";

type Choice = { store: "rohlik"; product: RohlikProduct; quantity: number } |
  { store: "lidl"; product: LidlOffer; quantity: number };
type Offers = { rohlik: RohlikProduct[]; lidl: LidlOffer[]; lidlErrors: number };

export function ShoppingAssistantPanel({ items }: { items: ShoppingListItem[] }) {
  const [connection, setConnection] = useState<{ configured: boolean; connected: boolean } | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [offers, setOffers] = useState<Record<string, Offers>>({});
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [error, setError] = useState<string | null>(null);
  const [cartBusy, setCartBusy] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);

  useEffect(() => {
    const refresh = () => {
      fetch("/api/rohlik/connection")
        .then((response) => response.json())
        .then((value) => setConnection(value))
        .catch(() => setConnection({ configured: false, connected: false }));
    };
    refresh();
    window.addEventListener("rohlik-connection-changed", refresh);
    return () => window.removeEventListener("rohlik-connection-changed", refresh);
  }, []);

  async function compare(item: ShoppingListItem) {
    setActiveKey(item.key);
    setError(null);
    try {
      const lidlResponse = await fetch(`/api/lidl/search?q=${encodeURIComponent(item.name)}`);
      const lidl = await lidlResponse.json() as { offers?: LidlOffer[]; errors?: number; error?: string };
      if (!lidlResponse.ok) throw new Error(lidl.error ?? "Lidl ceny se nepodařilo načíst.");
      let rohlik: RohlikProduct[] = [];
      if (connection?.connected) {
        const response = await fetch("/api/rohlik/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ queries: [{ keyword: item.name }], ingredientKey: item.key }),
        });
        const value = await response.json() as { products?: RohlikProduct[]; preferredProductId?: number | null; error?: string };
        if (!response.ok) throw new Error(value.error ?? "Rohlik hledání selhalo.");
        rohlik = (value.products ?? []).sort((a, b) => Number(b.productId === value.preferredProductId) - Number(a.productId === value.preferredProductId) || Number(b.favorite) - Number(a.favorite) || a.priceCzk - b.priceCzk);
      }
      setOffers((current) => ({ ...current, [item.key]: {
        rohlik: rohlik.filter((product) => product.inStock),
        lidl: lidl.offers ?? [],
        lidlErrors: lidl.errors ?? 0,
      } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Porovnání selhalo.");
    } finally {
      setActiveKey(null);
    }
  }

  function choose(item: ShoppingListItem, choice: Choice) {
    setChoices((current) => ({ ...current, [item.key]: choice }));
    setCartAdded(false);
  }

  function changeQuantity(key: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return;
    setChoices((current) => ({ ...current, [key]: { ...current[key], quantity } }));
    setCartAdded(false);
  }

  const rohlikChoices = Object.entries(choices).filter((entry): entry is [string, Extract<Choice, { store: "rohlik" }>] => entry[1].store === "rohlik");
  const lidlChoices = items.flatMap((item) => choices[item.key]?.store === "lidl" ? [{ item, choice: choices[item.key] as Extract<Choice, { store: "lidl" }> }] : []);

  async function addToCart() {
    setCartBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/rohlik/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: rohlikChoices.map(([ingredientKey, choice]) => ({ ingredientKey, productId: choice.product.productId, productName: choice.product.name, quantity: choice.quantity })) }),
      });
      const result = await response.json() as { success?: boolean; error?: string; message?: string };
      if (!response.ok || result.success === false) throw new Error(result.error ?? result.message ?? "Produkty se nepodařilo přidat.");
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

  return (
    <div className="mt-5 border-t border-stone-200 pt-4 space-y-3">
      <h4 className="text-sm font-semibold text-stone-800">Porovnání Rohlik a Lidl</h4>
      {!connection ? <p className="text-xs text-stone-500">Ověřuji připojení…</p> :
        !connection.configured ? <p className="text-xs text-amber-700">Pro připojení Rohlik nastav ROHLIK_TOKEN_ENCRYPTION_KEY na serveru.</p> :
          connection.connected ? <p className="text-xs text-green-700">Rohlik je připojený.</p> :
            <p className="text-xs text-stone-500">Připoj Rohlik účet v panelu výše.</p>}
      <p className="text-xs text-stone-500">Lidl ceny jsou z veřejných stránek a mohou se lišit podle prodejny či dne. Před výběrem ověř balení a dostupnost.</p>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      <ul className="space-y-3">
        {items.map((item) => {
          const result = offers[item.key];
          const choice = choices[item.key];
          return <li key={item.key} className="rounded-xl border border-stone-200 bg-white p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-stone-800">{item.name} · {item.amount} {item.unit}</span>
              <Button type="button" size="sm" variant="secondary" disabled={activeKey !== null} onClick={() => void compare(item)}>{activeKey === item.key ? "Hledám…" : "Porovnat"}</Button>
            </div>
            {result && <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-stone-700">Rohlik</p>
                {result.rohlik.length ? result.rohlik.map((product) => <button key={product.productId} type="button" onClick={() => choose(item, { store: "rohlik", product, quantity: priceForNeed(product.priceCzk, product.name, item.amount, item.unit)?.packages ?? 1 })} className={`block w-full rounded-lg border p-2 text-left text-xs ${choice?.store === "rohlik" && choice.product.productId === product.productId ? "border-green-600 bg-green-50" : "border-stone-200"}`}>
                  {product.name} · {formatCzk(product.priceCzk)} {product.favorite ? "★ oblíbené" : ""}
                  {priceForNeed(product.priceCzk, product.name, item.amount, item.unit) && <span className="block text-stone-500">Potřeba {priceForNeed(product.priceCzk, product.name, item.amount, item.unit)?.packages} bal. · {formatCzk(priceForNeed(product.priceCzk, product.name, item.amount, item.unit)!.totalCzk)}</span>}
                </button>) : <p className="text-xs text-stone-500">{connection?.connected ? "Nenalezeno" : "Připoj účet"}</p>}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-stone-700">Lidl</p>
                {result.lidl.length ? result.lidl.map((product) => <button key={product.productId} type="button" onClick={() => choose(item, { store: "lidl", product, quantity: priceForNeed(product.priceCzk, product.packaging, item.amount, item.unit)?.packages ?? 1 })} className={`block w-full rounded-lg border p-2 text-left text-xs ${choice?.store === "lidl" && choice.product.productId === product.productId ? "border-green-600 bg-green-50" : "border-stone-200"}`}>
                  {product.name} · {product.packaging} · {formatCzk(product.priceCzk)}
                  {priceForNeed(product.priceCzk, product.packaging, item.amount, item.unit) && <span className="block text-stone-500">Potřeba {priceForNeed(product.priceCzk, product.packaging, item.amount, item.unit)?.packages} bal. · {formatCzk(priceForNeed(product.priceCzk, product.packaging, item.amount, item.unit)!.totalCzk)}</span>}
                </button>) : <p className="text-xs text-stone-500">Nenalezeno na sledovaných stránkách.</p>}
                {result.lidlErrors > 0 && <p className="text-xs text-amber-700">Některé stránky Lidl se nepodařilo načíst.</p>}
              </div>
            </div>}
            {choice && <label className="flex items-center gap-2 text-xs text-stone-700">Počet balení
              <input type="number" min={1} max={100} value={choice.quantity} onChange={(event) => changeQuantity(item.key, Number(event.target.value))} className="w-16 rounded border border-stone-300 p-1" />
              · {choice.store === "rohlik" ? "Rohlik" : "Lidl"}
            </label>}
          </li>;
        })}
      </ul>
      {(rohlikChoices.length > 0 || lidlChoices.length > 0) && <div className="flex flex-wrap gap-2 items-center">
        <Button type="button" size="sm" disabled={!rohlikChoices.length || cartBusy || cartAdded} onClick={() => void addToCart()}>{cartBusy ? "Přidávám…" : cartAdded ? "Přidáno do košíku" : `Přidat ${rohlikChoices.length} položek do košíku Rohlik`}</Button>
        <Button type="button" size="sm" variant="secondary" disabled={!lidlChoices.length} onClick={copyLidlList}>Kopírovat seznam Lidl ({lidlChoices.length})</Button>
      </div>}
      {cartAdded && <p role="status" className="text-xs text-green-700">Produkty jsou v košíku Rohlik. Objednávku dokonči na Rohlik.cz.</p>}
      {lidlChoices.length > 0 && <ul className="text-xs text-stone-700 space-y-1">{lidlChoices.map(({ item, choice }) => <li key={item.key}>{choice.quantity}× <a href={choice.product.url} target="_blank" rel="noopener noreferrer" className="underline">{choice.product.name}</a> · {formatCzk(choice.product.priceCzk)}</li>)}</ul>}
    </div>
  );
}

function formatCzk(price: number) {
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK" }).format(price);
}
