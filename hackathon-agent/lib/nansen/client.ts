// Nansen API client.
// Auth: `apikey: <key>` header. Method: POST + JSON body.
// Base: https://api.nansen.ai/api/v1
// Verified endpoints (probed against live API on 2026-04-25):
//   POST /profiler/address/current-balance  → wallet holdings
//   POST /smart-money/netflow               → per-token SM netflows (chain-wide list)
//   POST /smart-money/holdings              → per-token SM holdings (chain-wide list)
//   POST /tgm/holders                       → per-token top holders with balance changes

import { cacheOr } from "@/lib/cache/memory";
import { STABLECOIN_SYMBOLS } from "@/config/stablecoins";

const baseUrl = (process.env.NANSEN_BASE_URL ?? "https://api.nansen.ai/api/v1").replace(/\/$/, "");
const apiKey = process.env.NANSEN_API_KEY;
const DEFAULT_CHAIN = process.env.DEFAULT_CHAIN ?? "base";

if (!apiKey) console.warn("[nansen] NANSEN_API_KEY missing");

async function nansenPost<T = any>(path: string, body: Record<string, any>): Promise<T> {
  const url = `${baseUrl}/${path.replace(/^\//, "")}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey ?? "" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`nansen ${res.status} ${path}: ${(await res.text()).slice(0, 240)}`);
  }
  return (await res.json()) as T;
}

export type Holding = {
  tokenSymbol: string;
  tokenAddress: string;
  chain: string;
  balanceUsd: number;
};

export type SmartMoneyFlow = {
  smartMoney7dNetFlowUsd: number | null;
  totalSmartMoneyHoldingsUsd: number | null;
};

export type HolderStats = {
  topHoldersStayingPct: number | null;
  top10ConcentrationChange7dPct: number | null;
  holderCountChange7dPct: number | null;
};

// ---- Wallet holdings ----
// POST /profiler/address/current-balance, body {address, chain}
// Response: {pagination, data:[{chain, address, token_address, token_symbol, value_usd, ...}]}
export async function getWalletHoldings(
  address: string,
  chain: string = DEFAULT_CHAIN,
): Promise<Holding[]> {
  return cacheOr("holdings", `${chain}:${address.toLowerCase()}`, 10 * 60 * 1000, async () => {
    try {
      // Try a few common pagination shapes; first that works wins.
      let data: any = null;
      const bodyVariants = [
        { address, chain, pagination: { page: 1, per_page: 50 } },
        { address, chain },
      ];
      for (const body of bodyVariants) {
        try {
          data = await nansenPost<any>("profiler/address/current-balance", body);
          break;
        } catch (err) {
          if (!String(err).includes("400") && !String(err).includes("Missing field")) throw err;
        }
      }
      const raw = (data?.data ?? data ?? []) as any[];
      if (!Array.isArray(raw)) return [];
      return raw
        .map((r): Holding => ({
          tokenSymbol: String(r.token_symbol ?? r.tokenSymbol ?? "?").toUpperCase(),
          tokenAddress: String(r.token_address ?? r.tokenAddress ?? "").toLowerCase(),
          chain: String(r.chain ?? chain),
          balanceUsd: Number(r.value_usd ?? r.balanceUsd ?? 0),
        }))
        // Drop stablecoins, zero-balance entries, and absurdly-large values
        // (Nansen feed glitches: e.g. fake "DOT" on Base reporting $1B+).
        .filter(
          (h) =>
            !STABLECOIN_SYMBOLS.has(h.tokenSymbol) &&
            h.balanceUsd > 0 &&
            h.balanceUsd < 100_000_000,
        );
    } catch (err) {
      console.error("[nansen.getWalletHoldings]", err instanceof Error ? err.message : err);
      return [];
    }
  });
}

// ---- Chain-wide SM netflow + SM holdings (cached, used to derive per-token Signal A) ----
async function fetchChainNetflow(chain: string): Promise<any[]> {
  return cacheOr("sm-netflow", chain, 10 * 60 * 1000, async () => {
    try {
      const data = await nansenPost<any>("smart-money/netflow", {
        chains: [chain],
        pagination: { page: 1, per_page: 500 },
      });
      const raw = (data?.data ?? []) as any[];
      return Array.isArray(raw) ? raw : [];
    } catch (err) {
      console.warn("[nansen.netflow]", err instanceof Error ? err.message : err);
      return [];
    }
  });
}

async function fetchChainSmHoldings(chain: string): Promise<any[]> {
  return cacheOr("sm-holdings", chain, 10 * 60 * 1000, async () => {
    try {
      const data = await nansenPost<any>("smart-money/holdings", {
        chains: [chain],
        pagination: { page: 1, per_page: 500 },
      });
      const raw = (data?.data ?? []) as any[];
      return Array.isArray(raw) ? raw : [];
    } catch (err) {
      console.warn("[nansen.smHoldings]", err instanceof Error ? err.message : err);
      return [];
    }
  });
}

export type ChainRegime = {
  totalNetFlow7dUsd: number;
  totalHoldingsUsd: number;
  regimePct: number; // chain-wide net flow as % of total SM holdings
};

export async function getChainRegime(chain: string = DEFAULT_CHAIN): Promise<ChainRegime> {
  const [netflow, holdings] = await Promise.all([
    fetchChainNetflow(chain),
    fetchChainSmHoldings(chain),
  ]);
  const totalNetFlow7dUsd = netflow.reduce(
    (s: number, n: any) => s + Number(n.net_flow_7d_usd ?? 0),
    0,
  );
  const totalHoldingsUsd = holdings.reduce(
    (s: number, h: any) => s + Number(h.value_usd ?? 0),
    0,
  );
  const regimePct = totalHoldingsUsd > 0 ? totalNetFlow7dUsd / totalHoldingsUsd : 0;
  return { totalNetFlow7dUsd, totalHoldingsUsd, regimePct };
}

export async function getTokenSmartMoneyFlow(
  tokenAddress: string,
  chain: string = DEFAULT_CHAIN,
): Promise<SmartMoneyFlow & { tokenFlowPct: number | null; chainRegimePct: number | null }> {
  const t = tokenAddress.toLowerCase();
  const [netflow, holdings, regime] = await Promise.all([
    fetchChainNetflow(chain),
    fetchChainSmHoldings(chain),
    getChainRegime(chain),
  ]);
  const nf = netflow.find((n: any) => String(n.token_address ?? "").toLowerCase() === t);
  const h = holdings.find((x: any) => String(x.token_address ?? "").toLowerCase() === t);
  const flow = nf?.net_flow_7d_usd ?? null;
  const totalHoldings = h?.value_usd ?? null;
  const tokenFlowPct =
    flow !== null && totalHoldings && totalHoldings > 0 ? flow / totalHoldings : null;
  return {
    smartMoney7dNetFlowUsd: flow,
    totalSmartMoneyHoldingsUsd: totalHoldings,
    tokenFlowPct,
    chainRegimePct: regime.regimePct,
  };
}

// ---- Token holder stats from tgm/holders ----
// Body: {token_address, chain[, pagination]}
// Response: {data:[{address, address_label, token_amount, total_outflow, total_inflow,
//                   balance_change_24h, balance_change_7d, balance_change_30d,
//                   ownership_percentage, value_usd}]}
export async function getTokenHolderStats(
  tokenAddress: string,
  chain: string = DEFAULT_CHAIN,
): Promise<HolderStats> {
  return cacheOr(
    "holder-stats",
    `${chain}:${tokenAddress.toLowerCase()}`,
    10 * 60 * 1000,
    async () => {
      try {
        const data = await nansenPost<any>("tgm/holders", {
          token_address: tokenAddress,
          chain,
          pagination: { page: 1, per_page: 100 },
        });
        const holders = (data?.data ?? []) as any[];
        if (!Array.isArray(holders) || holders.length === 0) {
          return {
            topHoldersStayingPct: null,
            top10ConcentrationChange7dPct: null,
            holderCountChange7dPct: null,
          };
        }

        // Signal B proxy: % of top holders with non-negative 30d balance change (still holding/accumulating)
        const withChange30d = holders.filter((h) => h.balance_change_30d !== undefined && h.balance_change_30d !== null);
        const stayingPct =
          withChange30d.length > 0
            ? (withChange30d.filter((h) => Number(h.balance_change_30d) >= 0).length / withChange30d.length) * 100
            : null;

        // Signal C: top-10 concentration drift over 7d.
        // Compute: (sum of top10 7d balance_change as token_amount) / (top10 current token_amount) * 100
        const top10 = holders.slice(0, 10);
        const top10Current = top10.reduce((s, h) => s + Number(h.token_amount ?? 0), 0);
        const top10Delta7d = top10.reduce((s, h) => s + Number(h.balance_change_7d ?? 0), 0);
        const top10ConcChange =
          top10Current > 0 && top10Delta7d !== 0 ? (top10Delta7d / top10Current) * 100 : null;

        // Signal D: holder count change. Not directly available from tgm/holders.
        // Approximate using fraction of top-100 holders with negative 7d change as growth proxy is unreliable.
        // Leave null — verdict treats null as 0 (no signal).
        return {
          topHoldersStayingPct: stayingPct,
          top10ConcentrationChange7dPct: top10ConcChange,
          holderCountChange7dPct: null,
        };
      } catch (err) {
        console.warn("[nansen.holderStats]", err instanceof Error ? err.message : err);
        return {
          topHoldersStayingPct: null,
          top10ConcentrationChange7dPct: null,
          holderCountChange7dPct: null,
        };
      }
    },
  );
}
