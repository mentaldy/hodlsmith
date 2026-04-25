# Changelog

All notable changes to Hodlsmith are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] — 2026-04-25 — Initial release

The first shippable Hodlsmith — an AI agent that scores wallet bags on a 7–30 day exit-liquidity risk window using deterministic on-chain signals narrated by an LLM.

### Added
- **Agent core** — `runBagCheck(wallet, { chain, limit })` as the importable entry point
- **Five-signal deterministic verdict scorer** with chain-regime baseline:
  - A: smart-money 7d net flow normalized to chain regime
  - B: top-100 holder conviction over 30d
  - C: concentration drift × smart-money direction
  - D: holder count growth × smart-money direction
  - E: trapped-retail composite (the textbook exit-liquidity pattern)
- **Nansen integration** — Profiler, Smart Money (netflow + holdings), Token God Mode, with verified API paths and chain-wide caching
- **Flock.io LLM** — batched per-bag explanations, action suggestions, and counter-hypotheses on every 🔴 verdict
- **Telegram surface** via grammY — paste-wallet UX, `/watch` + `/refresh`, free-text consultant mode, inline tap-to-detail buttons, market-context header
- **Multi-chain support** — `base`, `ethereum`, `bsc`, `polygon`, `arbitrum`, `optimism`, `solana`, `avalanche` selectable via flag
- **`all` flag** — show all bags (capped at 15) instead of top 5
- **Position-percentage display** — every bag line shows `(N%)` of portfolio
- **Concentration-risk callout** — auto-warns when any single bag exceeds 25% of portfolio
- **Horizon honesty** — bot states the 7–30d window in welcome and every verdict card
- **5 unit tests** on the verdict scorer (cooked / safe / watch / reduced-confidence / no-data)
- **`examples/`** — runnable demonstration of importing `runBagCheck` programmatically

### Known limitations
- Verdict thresholds are heuristic, not backtested. V2 ships a backtest engine for users to tune their own.
- Operating window is 7–30 days. Not suitable for intraday scalping or multi-year hodling.
- Top-100 holder churn is approximated as "% of current top-100 with non-decreasing 30d balance" because Nansen does not expose a 30-day-old top-100 snapshot.
- The agent uses `@/...` path-alias imports from a Next.js `tsconfig.json`. Importing from a separate project requires either matching the tsconfig or refactoring imports to relative — planned for a follow-up release.

### Hackathon attribution
- **Flock.io** — required LLM provider, model `qwen3-30b-a3b-instruct-2507`
- **Nansen** — every signal sourced from their API
