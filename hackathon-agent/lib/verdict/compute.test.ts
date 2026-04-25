import { describe, it, expect } from "vitest";
import { computeVerdict } from "./compute";

describe("computeVerdict", () => {
  it("returns 'cooked' for heavy SM exit + low holder retention + retail FOMO", () => {
    const r = computeVerdict({
      smartMoney7dNetFlowUsd: -2_000_000,
      totalSmartMoneyHoldingsUsd: 10_000_000,
      tokenFlowPct: -0.20, chainRegimePct: 0,
      topHoldersStayingPct: 40,
      top10ConcentrationChange7dPct: 12,
      holderCountChange7dPct: 25,
    });
    expect(r.scores.A).toBe(-2);
    expect(r.scores.B).toBe(-1);
    expect(r.scores.C).toBe(-1);
    expect(r.scores.D).toBe(-1);
    expect(r.totalScore).toBe(-5);
    expect(r.verdict).toBe("cooked");
  });

  it("returns 'safe' on heavy accumulation + sticky holders + organic growth", () => {
    const r = computeVerdict({
      smartMoney7dNetFlowUsd: 3_000_000,
      totalSmartMoneyHoldingsUsd: 10_000_000,
      tokenFlowPct: 0.30, chainRegimePct: 0,
      topHoldersStayingPct: 92,
      top10ConcentrationChange7dPct: 0,
      holderCountChange7dPct: 8,
    });
    expect(r.scores.A).toBe(2);
    expect(r.scores.B).toBe(2);
    expect(r.scores.C).toBe(0);
    expect(r.scores.D).toBe(1);
    expect(r.totalScore).toBe(5);
    expect(r.verdict).toBe("safe");
  });

  it("returns 'watch' on mild mixed signals", () => {
    const r = computeVerdict({
      smartMoney7dNetFlowUsd: -100_000,
      totalSmartMoneyHoldingsUsd: 10_000_000,
      tokenFlowPct: -0.01, chainRegimePct: 0,
      topHoldersStayingPct: 70,
      top10ConcentrationChange7dPct: 0,
      holderCountChange7dPct: 0,
    });
    expect(r.totalScore).toBe(0);
    expect(r.verdict).toBe("watch");
  });

  it("flags reduced confidence when smart money data is missing", () => {
    const r = computeVerdict({
      smartMoney7dNetFlowUsd: null,
      totalSmartMoneyHoldingsUsd: null,
      topHoldersStayingPct: 85,
      top10ConcentrationChange7dPct: null,
      holderCountChange7dPct: null,
      tokenFlowPct: null, chainRegimePct: null,
    });
    expect(r.flags.reducedConfidence).toBe(true);
    expect(r.scores.A).toBe(0);
    expect(r.verdict).toBe("watch");
  });

  it("returns 'no-data' verdict when all signals are null", () => {
    const r = computeVerdict({
      smartMoney7dNetFlowUsd: null,
      totalSmartMoneyHoldingsUsd: null,
      topHoldersStayingPct: null,
      top10ConcentrationChange7dPct: null,
      holderCountChange7dPct: null,
      tokenFlowPct: null, chainRegimePct: null,
    });
    expect(r.verdict).toBe("no-data");
  });
});
