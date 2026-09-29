"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type ConnectionStatus = { configured: boolean; connected: boolean; error?: string };

export function RohlikConnectionPanel() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("rohlik");
    if (result === "connected") setMessage("Rohlik účet je připojený.");
    if (result === "failed") setMessage("Připojení se nepodařilo. Zkus to znovu.");
    if (result === "cancelled") setMessage("Připojení bylo zrušené.");
    if (result === "unsupported-domain") setMessage("Rohlik odmítl OAuth callback na této doméně. Pro tuto adresu je potřeba povolená registrace OAuth klienta u Rohlik.");
    fetch("/api/rohlik/connection")
      .then((response) => response.json())
      .then((value: ConnectionStatus) => setStatus(value))
      .catch(() => setStatus({ configured: false, connected: false }));
  }, []);

  async function disconnect() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/rohlik/connection", { method: "DELETE" });
      if (!response.ok) throw new Error("Odpojení se nepodařilo.");
      setStatus({ configured: true, connected: false });
      setMessage("Rohlik účet byl odpojený.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Odpojení se nepodařilo.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="bg-white rounded-2xl border border-stone-200 p-4 mb-4 space-y-2" aria-label="Připojení Rohlik">
    <h2 className="text-sm font-semibold text-stone-800">Rohlik účet</h2>
    {!status ? <p className="text-xs text-stone-500">Ověřuji připojení…</p> :
      !status.configured ? <p className="text-xs text-amber-700">Připojení Rohlik musí být nejdřív nastavené na serveru.</p> :
        status.connected ? <div className="flex items-center gap-3"><p className="text-xs text-green-700">Připojeno</p><Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void disconnect()}>Odpojit</Button></div> :
          <a href="/api/rohlik/connect" className="inline-block rounded-xl bg-green-600 px-3 py-2 text-sm font-medium text-white">Připojit Rohlik</a>}
    {message && <p role="status" className="text-xs text-stone-700">{message}</p>}
  </section>;
}
