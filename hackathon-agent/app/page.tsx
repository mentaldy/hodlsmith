const BOT_HANDLE = process.env.NEXT_PUBLIC_BOT_HANDLE ?? "@hodlsmith_bot";
const BOT_LINK = `https://t.me/${BOT_HANDLE.replace(/^@/, "")}`;

export default function Landing() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6 py-12">
      <div className="max-w-2xl space-y-10">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.25em] text-yellow-400 font-mono">
            🔨 Hodlsmith
          </p>
          <h1 className="text-5xl md:text-6xl font-bold leading-[1.05] tracking-tight">
            Are you the <span className="text-red-500">exit liquidity</span>?
          </h1>
          <p className="text-xl text-gray-300 leading-relaxed">
            Hodlsmith forges a verdict for every bag in your wallet. Is smart money still in
            — or quietly walking out? Paste a wallet. Find out in seconds. Free, no signup.
          </p>
          <p className="text-sm text-gray-500 italic">
            The craft of hodling well.
          </p>
        </div>

        <a
          href={BOT_LINK}
          target="_blank"
          rel="noreferrer"
          className="inline-block bg-yellow-400 text-black px-8 py-4 rounded-full font-bold text-lg hover:bg-yellow-300 transition"
        >
          Open in Telegram → {BOT_HANDLE}
        </a>

        <div className="grid grid-cols-3 gap-6 pt-8 border-t border-gray-800 text-sm">
          <div>
            <p className="text-gray-500 font-mono text-xs">01 / PASTE</p>
            <p className="text-gray-200 mt-1">any wallet address</p>
          </div>
          <div>
            <p className="text-gray-500 font-mono text-xs">02 / FORGE</p>
            <p className="text-gray-200 mt-1">4 deterministic on-chain signals</p>
          </div>
          <div>
            <p className="text-gray-500 font-mono text-xs">03 / VERDICT</p>
            <p className="text-gray-200 mt-1">
              <span className="text-green-400">🟢</span>{" "}
              <span className="text-yellow-400">🟡</span>{" "}
              <span className="text-red-500">🔴</span> per bag
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-800 text-xs text-gray-500 space-y-2">
          <p>Built with Flock.io (LLM) + Nansen (on-chain data).</p>
          <p>
            <em>Not financial advice. Informational signal based on on-chain data.</em>
          </p>
        </div>
      </div>
    </main>
  );
}
