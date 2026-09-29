export type LidlOffer = {
  productId: number;
  name: string;
  priceCzk: number;
  packaging: string;
  url: string;
  fetchedAt: string;
  page: string;
};

const PAGES = [
  "https://www.lidl.cz/c/ceny-v-klidu/a10088117",
  "https://www.lidl.cz/c/cerstve-maso/a10080059",
];

function decodeAttribute(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

export function parseLidlOffers(html: string, page: string, fetchedAt: string): LidlOffer[] {
  const offers: LidlOffer[] = [];
  for (const match of html.matchAll(/data-grid-data="([^"]+)"/g)) {
    try {
      const product = JSON.parse(decodeAttribute(match[1])) as {
        productId?: number;
        title?: string;
        price?: { price?: number; packaging?: { text?: string } };
        canonicalUrl?: string;
        store?: boolean;
      };
      if (!product.store || !product.productId || !product.title ||
        !product.price?.price || !product.canonicalUrl?.startsWith("/p/")) continue;
      offers.push({
        productId: product.productId,
        name: product.title,
        priceCzk: product.price.price,
        packaging: product.price.packaging?.text ?? "",
        url: new URL(product.canonicalUrl, "https://www.lidl.cz").toString(),
        fetchedAt,
        page,
      });
    } catch {
      // The page also contains non-product grid data.
    }
  }
  return offers;
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("cs-CZ").replace(/[^a-z0-9]+/g, " ").trim();
}

export function findLidlOffers(offers: LidlOffer[], query: string, limit = 5): LidlOffer[] {
  const tokens = normalize(query).split(" ").filter((token) => token.length > 2);
  if (!tokens.length) return [];
  return offers.map((offer) => ({ offer, score: tokens.reduce((score, token) => score + (normalize(offer.name).includes(token) ? 1 : 0), 0) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.offer.priceCzk - b.offer.priceCzk)
    .slice(0, limit).map(({ offer }) => offer);
}

export async function searchLidlPrices(query: string): Promise<{ offers: LidlOffer[]; sources: string[]; errors: number }> {
  const catalog = await loadLidlCatalog();
  return { offers: findLidlOffers(catalog.offers, query), sources: catalog.sources, errors: catalog.errors };
}

export async function searchLidlPricesBatch(queries: string[]): Promise<{ offers: LidlOffer[][]; sources: string[]; errors: number }> {
  const catalog = await loadLidlCatalog();
  return { offers: queries.map((query) => findLidlOffers(catalog.offers, query)), sources: catalog.sources, errors: catalog.errors };
}

async function loadLidlCatalog(): Promise<{ offers: LidlOffer[]; sources: string[]; errors: number }> {
  const fetchedAt = new Date().toISOString();
  const results = await Promise.allSettled(PAGES.map(async (page) => {
    return parseLidlOffers(await fetchLidlPage(page), page, fetchedAt);
  }));
  const offers = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const unique = [...new Map(offers.map((offer) => [offer.productId, offer])).values()];
  return { offers: unique, sources: PAGES, errors: results.filter((result) => result.status === "rejected").length };
}

const pageCache = new Map<string, { html: string; fetchedAt: number }>();

function fetchLidlPage(page: string): Promise<string> {
  const cached = pageCache.get(page);
  if (cached && Date.now() - cached.fetchedAt < 60 * 60 * 1000) return Promise.resolve(cached.html);
  return new Promise((resolve, reject) => {
    const request = get(page, { maxHeaderSize: 256 * 1024, headers: { "Accept-Encoding": "identity" } }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Lidl HTTP ${response.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 8 * 1024 * 1024) {
          request.destroy(new Error("Lidl stránka je příliš velká."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => {
        const html = Buffer.concat(chunks).toString("utf8");
        pageCache.set(page, { html, fetchedAt: Date.now() });
        resolve(html);
      });
      response.on("error", reject);
    });
    request.setTimeout(15000, () => request.destroy(new Error("Lidl vyhledávání vypršelo.")));
    request.on("error", reject);
  });
}
import { get } from "node:https";
