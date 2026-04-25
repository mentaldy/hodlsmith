# 🔨 Hodlsmith

> *"The craft of hodling well."*

An AI agent that takes a wallet address and tells you, per position, whether smart money is still in your bags or quietly walking out — over a 7-to-30 day window.

**Surface-agnostic.** The agent is `runBagCheck()` — a pure function. Telegram is the live distribution today. Slack, MCP, web widgets, autonomous agents — anything that speaks TypeScript imports and runs.

**It does not relieve fear. It calibrates it** — converting vague *"something feels off"* anxiety into a citeable signal you can act on.

---

## ⚡ Get started in 3 lines

```ts
import { runBagCheck } from "@/lib/bagcheck";
const result = await runBagCheck("0x...wallet", { chain: "base" });
console.log(result.bags.map(b => `${b.holding.tokenSymbol}: ${b.scored.verdict}`));
```

Returns a structured per-bag verdict (`safe` / `watch` / `cooked`) with five on-chain signals, the LLM's plain-English explanation, a suggested action, and a counter-hypothesis on every cooked bag. See [`hackathon-agent/examples/import-as-library.ts`](hackathon-agent/examples/import-as-library.ts) for a full runnable demo.

---

## 🚀 Full setup (5 minutes)

### 1. Prerequisites

| Requirement | Why |
|---|---|
| **Node.js 20+** | tsx + native `--env-file` |
| **Nansen Pro account with API access** | Required for Profiler, Smart Money, and Token God Mode endpoints. See [Nansen membership](#nansen-membership-requirements) below. |
| **Flock.io API key** | Required LLM provider (`https://docs.flock.io/flock-products/api-platform`) |
| **Telegram Bot token** *(only if running the Telegram surface)* | From `@BotFather` |

### 2. Clone and install

```bash
git clone <this-repo> hodlsmith
cd hodlsmith/hackathon-agent
npm install
```

### 3. Configure environment

Copy `.env.example` → `.env.local` and fill:

```env
FLOCK_API_KEY=<your-flock-key>
FLOCK_BASE_URL=https://api.flock.io/v1
FLOCK_MODEL=qwen3-30b-a3b-instruct-2507
NANSEN_API_KEY=<your-nansen-key>
NANSEN_BASE_URL=https://api.nansen.ai/api/v1
TELEGRAM_BOT_TOKEN=<from-botfather>     # only for Telegram surface
DEFAULT_CHAIN=base                       # base | ethereum | bsc | polygon | arb | op | solana | avalanche
```

### 4. Run

**Telegram bot (long-polling, no webhook):**
```bash
npx tsx --env-file=.env.local scripts/poll-bot.ts
```

**As an importable library:** see [Importing the agent](#importing-the-agent) below.

**Tests:**
```bash
npm test
```

---

## 📦 Importing the agent

The agent is **a library**, not a hosted service. The Telegram bot is one consumer of that library — the same `runBagCheck()` function can power Slack bots, MCP servers, custom dashboards, or any other surface.

```ts
import { runBagCheck } from "@/lib/bagcheck";

// Top 5 bags on Base (default)
const result = await runBagCheck("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");

// Top 5 on Ethereum
await runBagCheck("0xabc...", { chain: "ethereum" });

// All bags (capped at 15) on Base
await runBagCheck("0xabc...", { limit: "all" });

// Custom: top 10 on Arbitrum
await runBagCheck("0xabc...", { chain: "arbitrum", limit: 10 });
```

The result is a fully structured `BagCheckResult`:

```ts
{
  walletAddress: string,
  chain: string,
  totalUsd: number,
  totalHoldings: number,   // total tokens in wallet on this chain
  bagsShown: number,       // how many made it past the dust/limit filter
  bags: Array<{
    holding:     { tokenSymbol, tokenAddress, chain, balanceUsd },
    signals:     { /* 5 signals, see scoring below */ },
    scored:      { verdict, totalScore, scores: {A,B,C,D,E}, flags },
    explanation: { oneLiner, paragraph, suggestedAction, counterHypothesis } | null,
  }>
}
```

Every surface (Telegram, Slack, MCP, web) is just a thin wrapper around this one function.

---

## 🧠 How it works

1. **Paste any wallet address.** No signup, no wallet connect, no money at risk.
2. **Bags fetched in parallel** via Nansen Profiler + Smart Money + Token God Mode APIs.
3. **Five-signal deterministic scoring** — the LLM never decides the verdict color. Same data → same verdict.
4. **Flock.io LLM** narrates the verdict, references signal numbers verbatim, suggests one action, includes a counter-hypothesis on every 🔴.

### The five signals

| # | Signal | What it captures |
|---|---|---|
| **A** | Smart-money 7d net flow, normalized to the token's SM holdings AND **adjusted for the chain regime** | Are insiders exiting *this token specifically* — not just every token because BTC is dumping? |
| **B** | Top-100 holder conviction over 30d | Are early/whale holders still convicted? |
| **C** | Concentration drift × A | Who is concentrating the float — smart money or trapped retail? |
| **D** | Holder count growth × A | Is retail FOMO-ing into a smart-money exit? |
| **E** | Trapped-retail composite (A<0 AND B>0) | The textbook *exit-liquidity trap*: smart leaving, dumb staying. The signal Hodlsmith was built to detect. |

Sum maps to verdict: **≥ +2 → 🟢 SAFE | -1 to +1 → 🟡 WATCH | ≤ -2 → 🔴 COOKED**.

All thresholds live in **one file** (`config/verdict-rules.ts`), tunable in seconds.

### Honest about what we don't claim

- **Weights are heuristic, not backtested.** V2's pitch is "encode and backtest your own thesis" — we don't claim optimal weights, we give users the tool to find theirs.
- **Horizon is narrow.** Signals operate on a 7–30 day window. For intraday scalpers, too slow. For multi-year hodlers, noise. The bot says this in every welcome and every verdict card.
- **"Holder conviction" is a proxy.** True churn would require a 30-day-old top-100 snapshot we don't have. We use *"% of current top-100 with non-decreasing 30d balance"* and label it honestly.

---

## 📚 Nansen membership requirements

Hodlsmith calls four Nansen endpoints. **Your Nansen plan must include API access** to all of them:

| Endpoint | Used for | Tier required |
|---|---|---|
| `POST /profiler/address/current-balance` | List a wallet's token holdings | Profiler API access (Pro tier or higher with API enabled) |
| `POST /smart-money/netflow` | 7d / 24h / 30d net flow per token (chain-wide) | Smart Money API access |
| `POST /smart-money/holdings` | Total SM holdings per token | Smart Money API access |
| `POST /tgm/holders` | Top-100 holders per token with balance changes | TGM API access (note: 5 credits per call) |

**Practical setup:** The cleanest path is a **Nansen Pro plan with the API add-on enabled**, or pay-per-call API credits. As of this build, that means roughly $99/month plus per-call credits at $0.01–$0.05 per call.

The cost per `runBagCheck()` is roughly **$0.05–$0.30 per call** depending on how many bags are analyzed (TGM holders is the heavy one). Chain-wide Smart Money data is cached in-memory for 10 minutes, so repeated checks within that window are nearly free.

If your Nansen plan doesn't include API access for one of the above endpoints, that signal is dropped and the verdict scoring marks it as "reduced confidence."

---

## 💬 Telegram bot — usage

```
0xWalletAddress                — top 5 bags on Base (default)
0xWalletAddress eth            — top 5 on Ethereum
0xWalletAddress all            — all bags on Base (capped at 15)
0xWalletAddress arb all        — all bags on Arbitrum
0xWalletAddress base 10        — top 10 on Base

Commands:
/watch <addr> [chain]          — remember a wallet for /refresh
/refresh                       — re-check the saved wallet
/help                          — usage info
```

Every result message has **inline buttons** — tap any token to get the full per-bag breakdown (signals + LLM commentary + suggested action + counter-hypothesis).

Free-text follow-up works after a check too — *"why is $TOKEN cooked?"* → consultant mode answers in context.

---

## 🌐 Surfaces (current and planned)

The agent (`runBagCheck()`) is surface-agnostic. Today it lives behind a Telegram bot. The same function powers everything else:

- **Telegram bot** *(today)* — retail holder paste-and-check
- **Slack bot** *(planned)* — DAO treasury committees running `/bagcheck` on multisig wallets
- **MCP server** *(planned)* — other AI agents (Claude, GPT, Cursor) call Hodlsmith as a tool
- **Web widget** *(later)* — DEX integrations showing bag-health warnings on swap pages

To build a new surface: import `runBagCheck`, wrap it in your platform's message format. ~50–200 lines of glue.

---

## 🔮 Why this exists — the gap

Three lenses on Nansen's data exist today: Profiler (wallet), Smart Money (cohort), Token God Mode (token). To answer *"is my position cooked"*, a Pro user opens three browser tabs and cross-references manually. Most retail users don't do that. They get dumped on instead.

Two adjacent products exist and don't close the gap:

- **Nansen AI agent** (Jan 2026): trading-forward "vibe trading" — built for traders who execute swaps, not the holder who simply wants a safety check.
- **Nansen Smart Alerts**: event-based, requires the user to know what to watch in advance, gated behind Pro.

Hodlsmith lives in that gap.

### Why this is good for Nansen (the symbiotic frame)

Hodlsmith is **not** "Nansen Pro for free." We pay Nansen per call. We bring retail users who'd never sign up for Pro. Some graduate. We're a top-of-funnel for them, not a competitor.

---

## 🛠 V2 — the forge

The free Hodlsmith answers *"is this safe right now?"*. The V2 forge answers *"by my own rules, would this have been safe historically?"*.

| | Nansen Smart Alerts | Hodlsmith Forge (V2) |
|---|---|---|
| Unit | Event ("wallet X bought Y") | Verdict (composite of 5 signals) |
| Setup | Configure trigger per token/wallet | Configure rule once, applies to every bag |
| **Backtest** | None | One button — replay 90 days, see whether your rule would have caught past distributions |
| Composability | Manual cross-referencing | Multiple signals natively |
| Sharing | Private to each Pro account | Public rule library |
| User | "I know exactly what to watch" | "Let me figure out what's worth watching" |

Forge isn't a replacement for Smart Alerts — it's the layer above it.

---

## ⚙️ Stack

- Next.js 16 + TypeScript on Vercel
- [grammY](https://grammy.dev/) — Telegram framework
- Nansen REST API — Profiler, Smart Money, Token God Mode
- Flock.io API Platform — required LLM (model: `qwen3-30b-a3b-instruct-2507`)
- CoinGecko free tier — BTC 7d market context
- Vitest — 5 unit tests on the verdict scorer

---

## 📂 Hackathon attribution

Sponsors: **Flock.io** (mandatory LLM, every verdict prose comes from Flock) and **Nansen** (deep integration — every signal sourced from their API).

## ⚠️ Not financial advice.
