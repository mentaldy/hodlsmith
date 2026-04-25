import { VERDICT_RULES as R } from "@/config/verdict-rules";
import type { BagSignals, ScoredBag, Verdict } from "./types";

export function computeVerdict(s: BagSignals): ScoredBag {
  const reasons: string[] = [];
  let reduced = false;

  // Signal A: smart money 7d flow normalized AND adjusted for chain regime.
  // Token's flow position RELATIVE to the chain baseline — so a market-wide
  // risk-off doesn't flag every token as cooked, only the ones being singled out.
  let A = 0;
  if (s.tokenFlowPct === null) {
    reduced = true;
    reasons.push("no-smart-money-data");
  } else {
    const chainBaseline = s.chainRegimePct ?? 0;
    const relativeFlow = s.tokenFlowPct - chainBaseline;
    if (relativeFlow <= R.signalA.heavyDistribution) A = -2;
    else if (relativeFlow <= R.signalA.mildDistribution) A = -1;
    else if (relativeFlow >= R.signalA.heavyAccumulation) A = 2;
    else if (relativeFlow >= R.signalA.mildAccumulation) A = 1;
  }

  let B = 0;
  if (s.topHoldersStayingPct === null) {
    reduced = true;
    reasons.push("no-holder-staying-data");
  } else {
    const p = s.topHoldersStayingPct;
    if (p >= R.signalB.veryHigh) B = 2;
    else if (p >= R.signalB.high) B = 1;
    else if (p >= R.signalB.midLow) B = 0;
    else if (p >= R.signalB.low) B = -1;
    else B = -2;
  }

  let C = 0;
  if (s.top10ConcentrationChange7dPct === null) {
    reduced = true;
    reasons.push("no-concentration-data");
  } else if (s.top10ConcentrationChange7dPct >= R.signalC.concentrationSurge) {
    if (A < 0) C = -1;
    else if (A > 0) C = 1;
  }

  let D = 0;
  if (s.holderCountChange7dPct === null) {
    reduced = true;
    reasons.push("no-holder-count-data");
  } else if (A < 0 && s.holderCountChange7dPct >= R.signalD.holderSurge) {
    D = -1;
  } else if (A > 0 && s.holderCountChange7dPct >= R.signalD.holderHealthy) {
    D = 1;
  }

  // Signal E: trapped-retail modifier. When smart money is exiting (A < 0)
  // AND top holders are stickier-than-baseline (B > 0), retail is absorbing
  // the distribution — the "exit liquidity" trap this product was built to flag.
  let E = 0;
  if (R.trappedRetail?.enabled && A < 0 && B > 0) {
    E = R.trappedRetail.penalty;
    reasons.push("trapped-retail-pattern");
  }

  const totalScore = A + B + C + D + E;

  const allNull =
    s.smartMoney7dNetFlowUsd === null &&
    s.totalSmartMoneyHoldingsUsd === null &&
    s.topHoldersStayingPct === null &&
    s.top10ConcentrationChange7dPct === null &&
    s.holderCountChange7dPct === null;

  let verdict: Verdict;
  if (allNull) verdict = "no-data";
  else if (totalScore >= R.thresholds.safe) verdict = "safe";
  else if (totalScore <= R.thresholds.cooked) verdict = "cooked";
  else verdict = "watch";

  return {
    verdict,
    totalScore,
    scores: { A, B, C, D, E },
    flags: { reducedConfidence: reduced, reasons },
  };
}
