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
  "You are a direct, friendly on-chain investing consultant. Cite numeric signals verbatim. Never name specific sell prices or timing. Respond with a valid JSON object only.";

const userPrompt = (bags: BagInput[]) =>
  [
    `For each of these ${bags.length} positions, write a verdict explanation in English.`,
    "",
    "Signals reference:",
    "- A: smart money 7d net flow vs total smart-money holdings (negative = exit)",
    "- B: % of top-100 holders still holding vs 30d ago",
    "- C: concentration drift × smart-money direction",
    "- D: holder-count growth × smart-money direction",
    "Total score range: -6 to +6. >=3 safe, <=-3 cooked, else watch.",
    "",
    "Bags:",
    JSON.stringify(bags, null, 2),
    "",
    "Return JSON with this exact shape:",
    `{"explanations":[{"symbol":"...","oneLiner":"...","paragraph":"...","suggestedAction":"...","counterHypothesis":"..."}]}`,
    "",
    "Rules:",
    "- oneLiner: under 60 chars, end with the dominant signal in numbers",
    "- paragraph: 2-3 sentences. Reference signal numbers verbatim.",
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
