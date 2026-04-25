export type Verdict = "safe" | "watch" | "cooked" | "dust" | "no-data";

export type BagSignals = {
  smartMoney7dNetFlowUsd: number | null;
  totalSmartMoneyHoldingsUsd: number | null;
  topHoldersStayingPct: number | null;
  top10ConcentrationChange7dPct: number | null;
  holderCountChange7dPct: number | null;
  // Chain-regime context: lets Signal A score this token's flow RELATIVE
  // to chain-wide smart-money posture, not just absolutely. Resolves the
  // case where every token looks bearish during a market-wide risk-off.
  tokenFlowPct: number | null;
  chainRegimePct: number | null;
};

export type ScoredBag = {
  verdict: Verdict;
  totalScore: number;
  scores: { A: number; B: number; C: number; D: number; E: number };
  flags: { reducedConfidence: boolean; reasons: string[] };
};
