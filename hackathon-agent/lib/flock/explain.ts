import { flockChat } from "./client";
import type { ScoredBag, BagSignals } from "@/lib/verdict/types";

export type BagInput = {
  symbol: string;
  positionUsd: number;
  signals: BagSignals;
  scored: ScoredBag;
};

export type BagExplanation = {
  symbol: string;
  oneLiner: string;
  paragraph: string;
  suggestedAction: string;
  counterHypothesis?: string;
};

const SYSTEM =
  "You are a direct, friendly on-chain investing consultant talking to a retail crypto holder. Cite the actual numbers (percentages, dollar amounts) verbatim from the data. Never name specific sell prices or timing. Respond with a valid JSON object only.";

const userPrompt = (bags: BagInput[]) =>
  [
    `For each of these ${bags.length} positions, write a verdict explanation in plain English.`,
    "",
    "What the data means (use these PLAIN LANGUAGE descriptions in your prose, never the letter codes):",
    "- smart money 7d net flow (negative = smart wallets exiting, positive = accumulating)",
    "- % of top-100 holders still holding vs 30d ago (high = sticky/convicted, low = churning)",
    "- top-10 concentration drift over 7d (rising while smart money exits = retail absorbing)",
    "- holder count growth over 7d (rising while smart money exits = retail FOMO into a dump)",
    "- trapped-retail flag fires when smart money is exiting AND top holders are sticky",
    "",
    "Bags:",
    JSON.stringify(bags, null, 2),
    "",
    "Return JSON with this exact shape:",
    `{"explanations":[{"symbol":"...","oneLiner":"...","paragraph":"...","suggestedAction":"...","counterHypothesis":"..."}]}`,
    "",
    "Rules — STRICT:",
    "- NEVER use letter codes (A, B, C, D, E) or 'Signal A/B/C' in any output text.",
    "- NEVER mention 'score', 'totalScore', or 'verdict' as a literal word in the prose.",
    "- Use natural language: 'smart money exited 18%', '47% of top holders dropped out', 'concentration rose 12% while smart money distributed', etc.",
    "- oneLiner: under 80 chars. Lead with the dominant observation in plain English with one number cited.",
    "  Good: 'Smart money pulled $12M while 89% of top holders stayed — classic exit-liquidity setup.'",
    "  Bad:  'Negative A, strong B; score -3.'",
    "- paragraph: 2–3 sentences in plain English. Cite numbers, not signal letters.",
    "- suggestedAction: ONE sentence. Never name a price or date.",
    "- counterHypothesis: REQUIRED if verdict is 'cooked'. One sentence, plausible bullish counter-read.",
    "- For 'safe' or 'watch', omit counterHypothesis or leave it empty.",
  ].join("\n");

function fallback(bags: BagInput[]): BagExplanation[] {
  return bags.map((b) => ({
    symbol: b.symbol,
    oneLiner: `${b.scored.verdict.toUpperCase()} (score ${b.scored.totalScore})`,
    paragraph: "Verdict computed from on-chain signals. LLM commentary unavailable.",
    suggestedAction: "Review the raw signals and decide.",
  }));
}

export async function explainBags(bags: BagInput[]): Promise<BagExplanation[]> {
  if (bags.length === 0) return [];
  let raw: string;
  try {
    raw = await flockChat(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt(bags) },
      ],
      { temperature: 0.3, jsonMode: true },
    );
  } catch (err) {
    console.error("[flock.explainBags] chat failed", err);
    return fallback(bags);
  }
  try {
    const parsed = JSON.parse(raw) as { explanations?: BagExplanation[] };
    return parsed.explanations ?? fallback(bags);
  } catch {
    console.warn("[flock.explainBags] non-JSON response, falling back");
    return fallback(bags);
  }
}
