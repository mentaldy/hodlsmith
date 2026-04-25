import { cacheOr } from "@/lib/cache/memory";

const base = process.env.COINGECKO_BASE_URL ?? "https://api.coingecko.com/api/v3";

export type MarketContext = {
  btc7dPct: number | null;
  regime: "bullish" | "bearish" | "flat";
};

export async function getMarketContext(): Promise<MarketContext> {
  return cacheOr("market", "btc7d", 10 * 60 * 1000, async () => {
    try {
      const url = `${base}/coins/markets?vs_currency=usd&ids=bitcoin&price_change_percentage=7d`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`coingecko ${res.status}`);
      const arr = (await res.json()) as Array<{
        price_change_percentage_7d_in_currency: number | null;
      }>;
      const pct = arr[0]?.price_change_percentage_7d_in_currency ?? null;
      const regime: MarketContext["regime"] =
        pct === null ? "flat" : pct >= 5 ? "bullish" : pct <= -5 ? "bearish" : "flat";
      return { btc7dPct: pct, regime };
    } catch (err) {
      console.warn("[coingecko]", err);
      return { btc7dPct: null, regime: "flat" };
    }
  });
}
