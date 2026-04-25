import { flockChat } from "./client";
import type { BagCheckResult } from "@/lib/bagcheck";

const SYSTEM =
  "You are a direct, friendly on-chain consultant. Answer in English. Never name specific prices or timing. Keep replies short (2-3 sentences). If the user asks about a bag in their recent check, reference the verdict and signals concretely.";

export async function consultantReply(
  question: string,
  lastCheck: BagCheckResult | undefined,
): Promise<string> {
  const ctx = lastCheck
    ? `Recent bag check for ${lastCheck.walletAddress} (top 5):\n` +
      lastCheck.bags
        .map(
          (b) =>
            `- $${b.holding.tokenSymbol}: ${b.scored.verdict} (score ${b.scored.totalScore}), position $${b.holding.balanceUsd.toFixed(0)}`,
        )
        .join("\n")
    : "(no recent bag check in this chat)";
  return flockChat(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Context:\n${ctx}\n\nQuestion: ${question}` },
    ],
    { temperature: 0.5 },
  );
}
