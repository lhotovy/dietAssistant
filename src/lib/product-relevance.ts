const RAW_PRODUCE: Record<string, string[]> = {
  bataty: ["bataty", "batat"],
  brambory: ["brambory", "brambor"],
  mrkev: ["mrkev", "mrkve"],
  cibule: ["cibule", "cibuli"],
  zazvor: ["zazvor", "zazvorovy"],
};

const PREPARED_FOOD_WORDS = new Set([
  "burger", "burgery", "gnocchi", "noky", "hranolky", "chipsy", "lupinky",
  "polevka", "omacka", "pyre", "kase", "pomazanka", "soup", "salat",
  "knedliky", "testoviny", "rizoto", "placicky", "krokety", "pizza",
  "směs", "smes", "mrazene", "mrazené", "predvarene", "predvarene",
]);

export function productTokens(value: string): string[] {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("cs-CZ").match(/[a-z0-9]+/g) ?? [];
}

/** Conservative identity check: unknown or prepared products remain for manual review. */
export function isRelevantProduct(ingredientName: string, productName: string): boolean {
  const query = productTokens(ingredientName);
  const product = productTokens(productName);
  if (!query.length || !product.length) return false;
  const produceAliases = RAW_PRODUCE[query.join(" ")];
  if (produceAliases) {
    return product.some((token) => produceAliases.includes(token)) &&
      !product.some((token) => PREPARED_FOOD_WORDS.has(token));
  }
  if (!query.every((token) => product.includes(token))) return false;
  if (query.join(" ") === "mleko" && product.some((token) => ["kokosove", "ryzove", "mandlove", "ovesne", "sojove"].includes(token))) {
    return false;
  }
  return !product.some((token) => PREPARED_FOOD_WORDS.has(token));
}
