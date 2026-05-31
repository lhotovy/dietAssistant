const TZ = "Europe/Prague";

function formatInTz(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("cs-CZ", { timeZone: TZ, ...options }).format(
    date
  );
}

/** YYYY-MM-DD in Europe/Prague */
export function isoDateInPrague(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(date);
}

function weekdayInPrague(date: Date): number {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[label] ?? 0;
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days, 12));
  return isoDateInPrague(utc);
}

function mondayOfWeekContaining(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const wd = weekdayInPrague(date);
  const diff = wd === 0 ? -6 : 1 - wd;
  return addDaysIso(iso, diff);
}

export function buildDateContext(now = new Date()): string {
  const today = isoDateInPrague(now);
  const todayLabel = formatInTz(now, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const thisWeekStart = mondayOfWeekContaining(today);
  const thisWeekEnd = addDaysIso(thisWeekStart, 6);
  const nextWeekStart = addDaysIso(thisWeekStart, 7);
  const nextWeekEnd = addDaysIso(nextWeekStart, 6);

  const fmtRange = (start: string, end: string) => `${start} – ${end}`;

  return `## AKTUÁLNÍ DATUM (časová zóna Europe/Prague)
- Dnes: ${todayLabel} (${today})
- Tento týden (po–ne): ${fmtRange(thisWeekStart, thisWeekEnd)}
- Příští týden (po–ne): ${fmtRange(nextWeekStart, nextWeekEnd)}

Při plánování jídel vždy používej data od dnešního dne nebo budoucí období dle požadavku uživatelky. Nikdy nepoužívej data z minulosti ani z tréninkových příkladů (např. rok 2022). „Příští týden“ = ${fmtRange(nextWeekStart, nextWeekEnd)}.`;
}
