import {
  getWalletHoldings,
  getTokenSmartMoneyFlow,
  getTokenHolderStats,
  type Holding,
} from "@/lib/nansen/client";
import { computeVerdict } from "@/lib/verdict/compute";
import type { BagSignals, ScoredBag } from "@/lib/verdict/types";
import { explainBags, type BagInput, type BagExplanation } from "@/lib/flock/explain";
import { VERDICT_RULES } from "@/config/verdict-rules";

export type ScoredHolding = {
  holding: Holding;
  signals: BagSignals;
  scored: ScoredBag;
  explanation: BagExplanation | null;
};

export type BagCheckResult = {
  walletAddress: string;
  chain: string;
  totalUsd: number;
  totalHoldings: number;
  bagsShown: number;
  bags: ScoredHolding[];
};

function toSignals(
  flow: {
    smartMoney7dNetFlowUsd: number | null;
    totalSmartMoneyHoldingsUsd: number | null;
    tokenFlowPct: number | null;
    chainRegimePct: number | null;
  },
  hs: {
    topHoldersStayingPct: number | null;
    top10ConcentrationChange7dPct: number | null;
    holderCountChange7dPct: number | null;
  },
): BagSignals {
  return {
    smartMoney7dNetFlowUsd: flow.smartMoney7dNetFlowUsd,
    totalSmartMoneyHoldingsUsd: flow.totalSmartMoneyHoldingsUsd,
    topHoldersStayingPct: hs.topHoldersStayingPct,
    top10ConcentrationChange7dPct: hs.top10ConcentrationChange7dPct,
    holderCountChange7dPct: hs.holderCountChange7dPct,
    tokenFlowPct: flow.tokenFlowPct,
    chainRegimePct: flow.chainRegimePct,
  };
}

const DEFAULT_DISPLAY_CAP = 15;

export type BagCheckOptions = {
  chain?: string;
  limit?: number | "all";
};

export async function runBagCheck(
  walletAddress: string,
  options: BagCheckOptions = {},
): Promise<BagCheckResult> {
  const chain = options.chain ?? process.env.DEFAULT_CHAIN ?? "base";
  const requestedLimit =
    options.limit === "all" ? DEFAULT_DISPLAY_CAP : Math.min(options.limit ?? 5, DEFAULT_DISPLAY_CAP);

  const all = await getWalletHoldings(walletAddress, chain);
  const top5 = all
    .filter((h) => h.balanceUsd >= VERDICT_RULES.dust.minPositionUsd)
    .sort((a, b) => b.balanceUsd - a.balanceUsd)
    .slice(0, requestedLimit);

  const enriched = await Promise.all(
    top5.map(async (h) => {
      const [flow, hs] = await Promise.all([
        getTokenSmartMoneyFlow(h.tokenAddress, h.chain),
        getTokenHolderStats(h.tokenAddress, h.chain),
      ]);
      const signals = toSignals(flow, hs);
      const scored = computeVerdict(signals);
      return { holding: h, signals, scored };
    }),
  );

  const explainInput: BagInput[] = enriched.map((e) => ({
    symbol: e.holding.tokenSymbol,
    positionUsd: e.holding.balanceUsd,
    signals: e.signals,
    scored: e.scored,
  }));

  let explanations: BagExplanation[] = [];
  try {
    explanations = await explainBags(explainInput);
  } catch (err) {
    console.error("[bagcheck.explain]", err);
  }
  const explByName: Record<string, BagExplanation> = {};
  for (const e of explanations) explByName[e.symbol] = e;

  return {
    walletAddress,
    chain,
    totalUsd: all.reduce((sum, h) => sum + h.balanceUsd, 0),
    totalHoldings: all.length,
    bagsShown: enriched.length,
    bags: enriched.map((e): ScoredHolding => ({
      ...e,
      explanation: explByName[e.holding.tokenSymbol] ?? null,
    })),
  };
}
