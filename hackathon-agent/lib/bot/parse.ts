// Parse free-form user input like:
//   "0xABC..."             → { address, chain:"base", limit:5 }
//   "0xABC... eth"         → { chain:"ethereum" }
//   "0xABC... all"         → { limit:"all" }
//   "0xABC... eth all"     → { chain:"ethereum", limit:"all" }
//   "/check 0xABC eth"     → same as above

const ADDRESS_REGEX = /(0x[a-fA-F0-9]{40})/;

const CHAIN_ALIASES: Record<string, string> = {
  eth: "ethereum",
  ethereum: "ethereum",
  base: "base",
  bsc: "bsc",
  bnb: "bsc",
  binance: "bsc",
  polygon: "polygon",
  matic: "polygon",
  arb: "arbitrum",
  arbitrum: "arbitrum",
  op: "optimism",
  optimism: "optimism",
  sol: "solana",
  solana: "solana",
  avalanche: "avalanche",
  avax: "avalanche",
};

const ALL_FLAGS = new Set(["all", "everything", "every"]);

export type ParsedQuery = {
  address: string | null;
  chain: string;
  limit: number | "all";
};

export function parseQuery(text: string, defaultChain = "base"): ParsedQuery {
  const m = text.match(ADDRESS_REGEX);
  const address = m ? m[1] : null;
  const tokens = text
    .replace(ADDRESS_REGEX, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  let chain = defaultChain;
  let limit: number | "all" = 5;

  for (const t of tokens) {
    if (CHAIN_ALIASES[t]) {
      chain = CHAIN_ALIASES[t];
    } else if (ALL_FLAGS.has(t)) {
      limit = "all";
    } else if (/^\d+$/.test(t)) {
      const n = parseInt(t, 10);
      if (n >= 1 && n <= 25) limit = n;
    }
  }
  return { address, chain, limit };
}
