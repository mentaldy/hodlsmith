import { InlineKeyboard } from "grammy";
import type { BagCheckResult, ScoredHolding } from "@/lib/bagcheck";
import type { MarketContext } from "@/lib/market/coingecko";

const VERDICT_LABEL: Record<string, string> = {
  safe: "🟢 SAFE",
  watch: "🟡 WATCH",
  cooked: "🔴 COOKED",
  dust: "⚪ DUST",
  "no-data": "⚪ NO DATA",
};

const VERDICT_EMOJI_ONLY: Record<string, string> = {
  safe: "🟢",
  watch: "🟡",
  cooked: "🔴",
  dust: "⚪",
  "no-data": "⚪",
};

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function fmtUsd(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export function formatSummary(r: BagCheckResult, m: MarketContext): string {
  const btc = m.btc7dPct === null ? "?" : `${m.btc7dPct.toFixed(1)}%`;
  const header = `🔨 *Hodlsmith forge — ${shortAddr(r.walletAddress)} · ${r.chain}*\nPortfolio: ${fmtUsd(r.totalUsd)} | ${r.bagsShown} of ${r.totalHoldings} bags shown | Market: BTC ${btc} / 7d`;

  if (r.bags.length === 0) {
    return `${header}\n\nNo qualifying bags found in this wallet on \`${r.chain}\`.\n\n_Not financial advice._`;
  }

  const heavyBag = r.bags.find(
    (b) => r.totalUsd > 0 && b.holding.balanceUsd / r.totalUsd > 0.25,
  );
  const concentrationCallout = heavyBag
    ? `\n⚠️ *Concentration:* $${heavyBag.holding.tokenSymbol} is ${Math.round(
        (heavyBag.holding.balanceUsd / r.totalUsd) * 100,
      )}% of your portfolio — its verdict dominates your outcome.`
    : "";

  const lines = r.bags.map((b) => {
    const verdict = VERDICT_LABEL[b.scored.verdict] ?? b.scored.verdict;
    const one = b.explanation?.oneLiner ?? `score ${b.scored.totalScore}`;
    const pct =
      r.totalUsd > 0 ? ` (${Math.round((b.holding.balanceUsd / r.totalUsd) * 100)}%)` : "";
    const sym = `$${b.holding.tokenSymbol}`.padEnd(8);
    return `\`${sym}${pct.padEnd(6)}\`  ${verdict}  — ${one}`;
  });

  const footer = "\n_Tap a token below for the full breakdown. Verdicts reflect 7–30d on-chain activity. Not financial advice._";
  return `${header}${concentrationCallout}\n\n${lines.join("\n")}${footer}`;
}

// Inline keyboard with one button per bag — tap to drill into detail.
// Callback data shape: `bag|<index>` so the handler can resolve via cached lastCheck.
export function buildBagKeyboard(r: BagCheckResult): InlineKeyboard {
  const kb = new InlineKeyboard();
  r.bags.forEach((b, i) => {
    const label = `${VERDICT_EMOJI_ONLY[b.scored.verdict] ?? "?"} ${b.holding.tokenSymbol}`;
    kb.text(label, `bag|${i}`);
    if ((i + 1) % 3 === 0) kb.row();
  });
  return kb;
}

export function formatDetail(b: ScoredHolding, chain: string): string {
  const verdict = VERDICT_LABEL[b.scored.verdict] ?? b.scored.verdict;
  const e = b.explanation;
  const sig = b.signals;

  const fmtPct = (n: number | null, suffix = "%") =>
    n === null ? "—" : `${n.toFixed(1)}${suffix}`;
  const fmtFlow = (n: number | null) => (n === null ? "—" : fmtUsd(n));

  const lines = [
    `*$${b.holding.tokenSymbol}* on \`${chain}\`  ${verdict}  (score ${b.scored.totalScore})`,
    "",
    `Position: ${fmtUsd(b.holding.balanceUsd)}`,
    `Top holders staying: ${fmtPct(sig.topHoldersStayingPct)}`,
    `Smart money 7d flow: ${fmtFlow(sig.smartMoney7dNetFlowUsd)}`,
    `Top-10 concentration Δ7d: ${fmtPct(sig.top10ConcentrationChange7dPct)}`,
    `Holder count Δ7d: ${fmtPct(sig.holderCountChange7dPct)}`,
    "",
    e?.paragraph ?? "(no commentary available)",
  ];

  if (e?.suggestedAction) lines.push("", `⚠️ ${e.suggestedAction}`);
  if (e?.counterHypothesis && e.counterHypothesis.trim().length > 0) {
    lines.push(`_Counter-view: ${e.counterHypothesis}_`);
  }
  lines.push("", "_Based on 7–30d on-chain activity. Not a price prediction._");

  return lines.join("\n");
}

export function formatThesisHook(r: BagCheckResult): string {
  const cooked = r.bags
    .filter((b) => b.scored.verdict === "cooked")
    .sort((a, b) => a.scored.totalScore - b.scored.totalScore)[0];
  if (!cooked) return "";
  return `💡 _Bonus: smart money showed a clear pattern on $${cooked.holding.tokenSymbol}. Want to forge your own thesis and backtest it across all your bags? Reply "forge" to join V2._`;
}

export const WELCOME_TEXT =
  "🔨 *Hodlsmith*\n_The craft of hodling well._\n\n" +
  "I score every bag in your wallet on a 7–30 day exit-liquidity risk window. " +
  "Not a price prediction — a calibrated read on whether smart money is leaving (or staying).\n\n" +
  "*Usage:*\n" +
  "`0xWalletAddress`                — top 5 bags on Base\n" +
  "`0xWallet eth`                   — top 5 on Ethereum\n" +
  "`0xWallet all`                   — all bags (capped at 15)\n" +
  "`0xWallet base all`              — all bags on Base\n\n" +
  "Supported chains: `base`, `eth`, `bsc`, `polygon`, `arb`, `op`, `solana`, `avax`.\n\n" +
  "Commands: /watch /refresh /help";

export const HELP_TEXT =
  "*Hodlsmith help*\n\n" +
  "Paste a wallet address with optional flags:\n" +
  "  `0x... [chain] [all|N]`\n\n" +
  "Examples:\n" +
  "• `0xd8dA…96045`           — top 5 bags on Base\n" +
  "• `0xd8dA…96045 eth`       — top 5 on Ethereum\n" +
  "• `0xd8dA…96045 base all`  — all bags on Base\n\n" +
  "Commands:\n" +
  "/watch <addr> [chain]  — remember this wallet\n" +
  "/refresh               — re-check the saved wallet\n" +
  "/help                  — this message\n\n" +
  "_Tap a token in the result for the full breakdown._\n" +
  "_Not financial advice._";

export const MSG = {
  checking: "⏳ Forging your verdict…",
  invalidAddress: "Paste a 0x... wallet address. Optional: chain + `all` flag.",
  noWatchedWallet: "No wallet saved. Use `/watch <address>` first, then `/refresh`.",
  watched: "Got it — I'll remember this wallet for /refresh.",
  errorGeneric: "Something broke. Try again in a moment.",
  waitlistThanks:
    "You're on the V2 forge waitlist 🔨 — when it ships, you'll be able to encode your own thesis and backtest it across all your bags.",
  detailLost:
    "I don't have that bag in memory anymore — paste the wallet again to refresh.",
};
