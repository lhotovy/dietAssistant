"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type PlanningProfile = {
  instructions: string;
  maxSugarsPerDay: number | null;
  minProteinPerDay: number | null;
};

export function PlanningProfilePanel({ userReady }: { userReady: boolean }) {
  const [profile, setProfile] = useState<PlanningProfile>({ instructions: "", maxSugarsPerDay: null, minProteinPerDay: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!userReady) return;
    let active = true;
    fetch("/api/planning-profile")
      .then((response) => {
        if (!response.ok) throw new Error("Pravidla se nepodařilo načíst.");
        return response.json();
      })
      .then((data: PlanningProfile) => { if (active) setProfile(data); })
      .catch(() => { if (active) setMessage("Pravidla se nepodařilo načíst."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userReady]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/planning-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Pravidla se nepodařilo uložit.");
      setProfile(body as PlanningProfile);
      setMessage("Pravidla uložena.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Pravidla se nepodařilo uložit.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="bg-white rounded-2xl border border-stone-200 mb-4">
      <summary className="p-4 text-sm font-semibold text-stone-800 cursor-pointer">Pravidla pro plánování</summary>
      <div className="px-4 pb-4 space-y-3">
        {loading ? <p className="text-xs text-stone-500">Načítám pravidla…</p> : (
          <>
            <label className="block text-xs text-stone-600">Obecné pokyny
              <textarea value={profile.instructions} maxLength={2000} rows={3} onChange={(event) => setProfile((current) => ({ ...current, instructions: event.target.value }))} placeholder="Např. více zeleniny, bez opakování večeří…" className="block mt-1 w-full rounded-lg border border-stone-300 p-2 text-sm" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-stone-600">Cukry max. (g/den)
                <input type="number" min="0" max="1000" step="0.1" value={profile.maxSugarsPerDay ?? ""} onChange={(event) => setProfile((current) => ({ ...current, maxSugarsPerDay: event.target.value === "" ? null : Number(event.target.value) }))} className="block mt-1 w-full rounded-lg border border-stone-300 px-2 py-1 text-sm" />
              </label>
              <label className="text-xs text-stone-600">Bílkoviny min. (g/den)
                <input type="number" min="0" max="1000" step="0.1" value={profile.minProteinPerDay ?? ""} onChange={(event) => setProfile((current) => ({ ...current, minProteinPerDay: event.target.value === "" ? null : Number(event.target.value) }))} className="block mt-1 w-full rounded-lg border border-stone-300 px-2 py-1 text-sm" />
              </label>
            </div>
            <p className="text-xs text-stone-500">Denní limity platí na jednu porci každého jídla. Plán s chybějícími výživovými hodnotami nelze ověřit ani uložit. Hodnoty lze doplnit u receptů.</p>
            {message && <p role="status" className="text-xs text-stone-700">{message}</p>}
            <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>Uložit pravidla</Button>
          </>
        )}
      </div>
    </details>
  );
}
