"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type ConnectionStatus = { configured: boolean; oauthConfigured?: boolean; connected: boolean; method?: "oauth" | "legacy" | null; error?: string };

export function RohlikConnectionPanel() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showLegacy, setShowLegacy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
      setStatus((current) => ({ configured: true, oauthConfigured: current?.oauthConfigured, connected: false }));
      window.dispatchEvent(new Event("rohlik-connection-changed"));
      setMessage("Rohlik účet byl odpojený.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Odpojení se nepodařilo.");
    } finally {
      setBusy(false);
    }
  }

  async function connectLegacy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/rohlik/legacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Připojení se nepodařilo.");
      setStatus((current) => ({ configured: true, oauthConfigured: current?.oauthConfigured, connected: true, method: "legacy" }));
      window.dispatchEvent(new Event("rohlik-connection-changed"));
      setShowLegacy(false);
      setEmail("");
      setMessage("Rohlik účet je připojený přes legacy MCP.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Připojení se nepodařilo.");
    } finally {
      setPassword("");
      setBusy(false);
    }
  }

  return <section className="bg-white rounded-2xl border border-stone-200 p-4 mb-4 space-y-2" aria-label="Připojení Rohlik">
    <h2 className="text-sm font-semibold text-stone-800">Rohlik účet</h2>
    {!status ? <p className="text-xs text-stone-500">Ověřuji připojení…</p> :
      !status.configured ? <p className="text-xs text-amber-700">Připojení Rohlik musí být nejdřív nastavené na serveru.</p> :
        status.connected ? <div className="flex items-center gap-3"><p className="text-xs text-green-700">Připojeno{status.method === "legacy" ? " přes legacy MCP" : ""}</p><Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void disconnect()}>Odpojit</Button></div> :
          <div className="space-y-3">
            {status.oauthConfigured && <a href="/api/rohlik/connect" className="inline-block rounded-xl bg-green-600 px-3 py-2 text-sm font-medium text-white">Připojit přes OAuth</a>}
            <div><Button type="button" size="sm" variant="secondary" onClick={() => setShowLegacy((value) => !value)}>{showLegacy ? "Skrýt legacy přihlášení" : "Připojit e-mailem a heslem (legacy)"}</Button></div>
            {showLegacy && <form onSubmit={(event) => void connectLegacy(event)} className="space-y-2 max-w-sm">
              <p className="text-xs text-amber-700">Rohlik tuto starší metodu dokumentuje pro MCP klienty. Heslo se odešle jen serveru Diet Assistant, uloží se tam šifrovaně a použije se pro požadavky na Rohlik. Po odpojení se smaže.</p>
              <label className="block text-xs text-stone-700">E-mail Rohlik<input type="email" autoComplete="username" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 block w-full rounded border border-stone-300 p-2" /></label>
              <label className="block text-xs text-stone-700">Heslo Rohlik<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 block w-full rounded border border-stone-300 p-2" /></label>
              <Button type="submit" size="sm" disabled={busy}>{busy ? "Ověřuji…" : "Ověřit a připojit"}</Button>
            </form>}
          </div>}
    {message && <p role="status" className="text-xs text-stone-700">{message}</p>}
  </section>;
}
