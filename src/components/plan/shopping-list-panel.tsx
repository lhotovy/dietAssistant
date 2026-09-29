"use client";

import { useEffect, useState } from "react";
import { ClipboardCopy, ShoppingBasket } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ShoppingListItem } from "@/lib/shopping-list";
import { ShoppingAssistantPanel } from "@/components/plan/shopping-assistant-panel";

type ShoppingListResponse = {
  items: ShoppingListItem[];
  missingRecipeIds: string[];
  skippedIngredients: number;
};

export function ShoppingListPanel({ planId, planVersion }: { planId: string; planVersion: string }) {
  const [servings, setServings] = useState(1);
  const [result, setResult] = useState<ShoppingListResponse | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/plans/${encodeURIComponent(planId)}/shopping-list?servings=${servings}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Seznam se nepodařilo načíst.");
        return body as ShoppingListResponse;
      })
      .then((body) => {
        if (!active) return;
        setResult(body);
        setChecked([]);
        setError(null);
      })
      .catch((cause) => {
        if (!active) return;
        setResult(null);
        setError(cause instanceof Error ? cause.message : "Seznam se nepodařilo načíst.");
      });
    return () => { active = false; };
  }, [planId, planVersion, servings]);

  async function copyList() {
    if (!result) return;
    const text = result.items
      .map((item) => `${formatAmount(item.amount)} ${item.unit} ${item.name}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setError("Kopírování není v tomto prohlížeči dostupné.");
    }
  }

  return (
    <section className="p-4 bg-stone-50" aria-label="Nákupní seznam">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold text-stone-800 flex items-center gap-2">
          <ShoppingBasket className="h-4 w-4" /> Nákupní seznam
        </h4>
        <Button variant="ghost" size="sm" onClick={copyList} disabled={!result?.items.length} aria-label="Kopírovat nákupní seznam">
          <ClipboardCopy className="h-4 w-4" />
        </Button>
      </div>
      <label className="text-xs text-stone-600 flex items-center gap-2 mb-3">
        Porcí na každé jídlo
        <input
          type="number"
          min={1}
          max={12}
          value={servings}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isInteger(next) && next >= 1 && next <= 12) setServings(next);
          }}
          className="w-14 rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm"
        />
      </label>
      <p className="text-xs text-stone-500 mb-3">
        Množství vychází z receptů a jejich počtu porcí. Zásoby doma zatím nejsou odečtené.
      </p>
      {error && <p role="alert" className="text-xs text-red-600 mb-2">{error}</p>}
      {result && (
        <>
          {(result.missingRecipeIds.length > 0 || result.skippedIngredients > 0) && (
            <p role="status" className="text-xs text-amber-700 mb-2">
              Seznam není úplný: chybí {result.missingRecipeIds.length} receptů a {result.skippedIngredients} surovin má neplatné množství.
            </p>
          )}
          {result.items.length === 0 ? (
            <p className="text-sm text-stone-500">V plánu nejsou žádné suroviny.</p>
          ) : (
            <><ul className="space-y-1.5">
              {result.items.map((item) => (
                <li key={item.key}>
                  <label className="flex gap-2 items-start text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={checked.includes(item.key)}
                      onChange={() => setChecked((current) => current.includes(item.key) ? current.filter((key) => key !== item.key) : [...current, item.key])}
                      className="mt-1 accent-green-600"
                    />
                    <span className={checked.includes(item.key) ? "line-through text-stone-400" : ""}>
                      <strong>{formatAmount(item.amount)} {item.unit}</strong> {item.name}
                    </span>
                  </label>
                </li>
              ))}
            </ul><ShoppingAssistantPanel key={`${planId}:${planVersion}:${servings}`} items={result.items} /></>
          )}
        </>
      )}
    </section>
  );
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(amount);
}
