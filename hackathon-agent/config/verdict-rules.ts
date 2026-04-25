export const VERDICT_RULES = {
  signalA: {
    heavyDistribution: -0.15,
    mildDistribution: -0.05,
    mildAccumulation: 0.05,
    heavyAccumulation: 0.15,
  },
  signalB: {
    veryHigh: 90,
    high: 80,
    midLow: 60,
    low: 30,
  },
  signalC: {
    concentrationSurge: 5,
  },
  trappedRetail: {
    enabled: true,
    penalty: -1,
  },
  signalD: {
    holderSurge: 20,
    holderHealthy: 5,
  },
  thresholds: {
    safe: 2,
    cooked: -2,
  },
  dust: {
    minPositionUsd: 50,
  },
};
