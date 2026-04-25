/**
 * Example: Import Hodlsmith's agent core programmatically.
 *
 * This file demonstrates that the agent (`runBagCheck`) is a library — not
 * a service or a bot. Any surface (Telegram, Slack, MCP server, web widget,
 * dashboard, voice, autonomous trading agent) is a thin client over this
 * one function.
 *
 * Run: npx tsx --env-file=.env.local examples/import-as-library.ts
 *
 * Required env vars: FLOCK_API_KEY, FLOCK_BASE_URL, FLOCK_MODEL,
 *                    NANSEN_API_KEY, NANSEN_BASE_URL.
 *
 * Caveat: this works because we run from inside the cloned repo where the
 * `@/...` path alias resolves through Next.js's tsconfig. Importing from a
 * separate project requires either matching the tsconfig paths or
 * refactoring to relative imports.
 */
import { runBagCheck } from "@/lib/bagcheck";

(async () => {
  // 1) Top 5 bags on Base (default) for Vitalik's wallet
  const result = await runBagCheck(
    "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    { chain: "base" },
  );

  console.log("✓ runBagCheck imported and ran successfully\n");
  console.log(`Wallet:  ${result.walletAddress}`);
  console.log(`Chain:   ${result.chain}`);
  console.log(`Total:   $${result.totalUsd.toFixed(0)}`);
  console.log(`Bags:    ${result.bags.length} of ${result.totalHoldings}\n`);

  result.bags.forEach((b) => {
    const symbol = `$${b.holding.tokenSymbol}`.padEnd(12);
    const verdict = b.scored.verdict.padEnd(6);
    const score = `score ${b.scored.totalScore.toString().padStart(2)}`;
    const oneLiner = b.explanation?.oneLiner ?? "";
    console.log(`  ${symbol} ${verdict} (${score})  ${oneLiner}`);
  });

  // 2) Show only bags that came back COOKED
  const cooked = result.bags.filter((b) => b.scored.verdict === "cooked");
  if (cooked.length > 0) {
    console.log(`\n🔴 ${cooked.length} cooked bag(s):`);
    cooked.forEach((b) => {
      console.log(`  $${b.holding.tokenSymbol}`);
      if (b.explanation?.suggestedAction) {
        console.log(`    suggested: ${b.explanation.suggestedAction}`);
      }
      if (b.explanation?.counterHypothesis) {
        console.log(`    counter:   ${b.explanation.counterHypothesis}`);
      }
    });
  }
})();
