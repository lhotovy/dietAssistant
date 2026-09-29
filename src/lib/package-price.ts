type BaseUnit = "g" | "ml" | "ks";

export function parsePackageSize(label: string): { amount: number; unit: BaseUnit } | null {
  const match = label.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|ks)\b/i);
  if (!match) return null;
  const amount = Number(match[1].replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = match[2].toLowerCase();
  if (unit === "kg") return { amount: amount * 1000, unit: "g" };
  if (unit === "l") return { amount: amount * 1000, unit: "ml" };
  return { amount, unit: unit as BaseUnit };
}

export function priceForNeed(priceCzk: number, packageLabel: string, neededAmount: number, neededUnit: string): { packages: number; totalCzk: number } | null {
  const size = parsePackageSize(packageLabel);
  if (!size || size.unit !== neededUnit || !Number.isFinite(neededAmount) || neededAmount <= 0) return null;
  const packages = Math.ceil(neededAmount / size.amount);
  return { packages, totalCzk: Math.round(packages * priceCzk * 100) / 100 };
}
