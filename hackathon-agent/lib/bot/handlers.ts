import { Context } from "grammy";
import { runBagCheck } from "@/lib/bagcheck";
import { getMarketContext } from "@/lib/market/coingecko";
import { consultantReply } from "@/lib/flock/consultant";
import { getChat, setChat } from "@/lib/chat/memory";
import {
  formatSummary,
  formatDetail,
  formatThesisHook,
  buildBagKeyboard,
  WELCOME_TEXT,
  HELP_TEXT,
  CRITERIA_TEXT,
  MSG,
} from "./formatters";
import { parseQuery } from "./parse";

const ADDRESS_REGEX = /(0x[a-fA-F0-9]{40})/;
const DEFAULT_CHAIN = process.env.DEFAULT_CHAIN ?? "base";

export async function onStart(ctx: Context) {
  await ctx.reply(WELCOME_TEXT, { parse_mode: "Markdown" });
}

export async function onHelp(ctx: Context) {
  await ctx.reply(HELP_TEXT, { parse_mode: "Markdown" });
}

export async function onCriteria(ctx: Context) {
  await ctx.reply(CRITERIA_TEXT, { parse_mode: "Markdown" });
}

export async function onWatch(ctx: Context) {
  const id = ctx.chat?.id;
  if (!id) return;
  const arg = String(ctx.match ?? "").trim();
  const parsed = parseQuery(arg, DEFAULT_CHAIN);
  if (!parsed.address) {
    await ctx.reply(MSG.invalidAddress);
    return;
  }
  setChat(id, { wallet: parsed.address, watchedChain: parsed.chain });
  await ctx.reply(`${MSG.watched} (chain: \`${parsed.chain}\`)`, { parse_mode: "Markdown" });
}

export async function onRefresh(ctx: Context) {
  const id = ctx.chat?.id;
  if (!id) return;
  const state = getChat(id);
  if (!state.wallet) {
    await ctx.reply(MSG.noWatchedWallet, { parse_mode: "Markdown" });
    return;
  }
  await runCheckAndReply(ctx, state.wallet, {
    chain: state.watchedChain ?? DEFAULT_CHAIN,
    limit: 5,
  });
}

export async function onText(ctx: Context) {
  const id = ctx.chat?.id;
  if (!id) return;
  const text = ctx.message?.text?.trim() ?? "";

  if (["waitlist", "forge", "v2"].includes(text.toLowerCase())) {
    await ctx.reply(MSG.waitlistThanks);
    return;
  }

  // If the message contains a wallet address, run a bag check (with optional flags)
  if (ADDRESS_REGEX.test(text)) {
    const parsed = parseQuery(text, DEFAULT_CHAIN);
    if (parsed.address) {
      await runCheckAndReply(ctx, parsed.address, {
        chain: parsed.chain,
        limit: parsed.limit,
      });
      return;
    }
  }

  // Otherwise route through the consultant
  const last = getChat(id).lastCheck;
  try {
    const reply = await consultantReply(text, last);
    await ctx.reply(reply || "(no reply)");
  } catch (err) {
    console.error("[handlers.consultant]", err);
    await ctx.reply(MSG.errorGeneric);
  }
}

// Callback for inline-button taps in summary message: "bag|<index>" → send detail card.
export async function onCallback(ctx: Context) {
  const id = ctx.chat?.id;
  const data = ctx.callbackQuery?.data ?? "";
  if (!id || !data.startsWith("bag|")) {
    await ctx.answerCallbackQuery().catch(() => undefined);
    return;
  }
  const idx = parseInt(data.slice(4), 10);
  const state = getChat(id);
  const lastCheck = state.lastCheck;
  if (!lastCheck || isNaN(idx) || !lastCheck.bags[idx]) {
    await ctx.answerCallbackQuery({ text: "Bag not in memory — paste wallet again." });
    return;
  }
  const bag = lastCheck.bags[idx];
  await ctx.answerCallbackQuery({ text: `$${bag.holding.tokenSymbol} details` });
  try {
    await ctx.reply(formatDetail(bag, lastCheck.chain), { parse_mode: "Markdown" });
  } catch (err) {
    console.error("[handlers.callback]", err);
  }
}

async function runCheckAndReply(
  ctx: Context,
  wallet: string,
  opts: { chain: string; limit: number | "all" },
) {
  const id = ctx.chat?.id;
  if (!id) return;
  const placeholder = await ctx.reply(MSG.checking);
  try {
    const [check, market] = await Promise.all([
      runBagCheck(wallet, { chain: opts.chain, limit: opts.limit }),
      getMarketContext(),
    ]);
    setChat(id, {
      lastCheck: check,
      lastCheckAt: Date.now(),
      wallet,
      watchedChain: opts.chain,
    });
    const summary = formatSummary(check, market);
    const hook = formatThesisHook(check);
    const fullMsg = hook ? `${summary}\n\n${hook}` : summary;
    const keyboard = check.bags.length > 0 ? buildBagKeyboard(check) : undefined;
    await ctx.api.editMessageText(id, placeholder.message_id, fullMsg, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  } catch (err) {
    console.error("[handlers.runCheckAndReply]", err);
    try {
      await ctx.api.editMessageText(id, placeholder.message_id, MSG.errorGeneric);
    } catch {
      await ctx.reply(MSG.errorGeneric);
    }
  }
}
