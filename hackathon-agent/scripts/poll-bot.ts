// Long-polling runner for local testing. No webhook, no tunnel needed.
// Run: npx tsx --env-file=.env.local scripts/poll-bot.ts
import { Bot } from "grammy";
import { onStart, onHelp, onWatch, onRefresh, onText, onCallback } from "@/lib/bot/handlers";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN missing in .env.local");
  process.exit(1);
}

const bot = new Bot(token);
bot.command("start", onStart);
bot.command("help", onHelp);
bot.command("watch", onWatch);
bot.command("refresh", onRefresh);
bot.on("callback_query:data", onCallback);
bot.on("message:text", onText);

bot.catch((err) => {
  console.error("[bot.catch]", err.error);
});

console.log("Hodlsmith — long-polling mode. Ctrl-C to stop.");
bot.start({
  onStart: (info) => {
    console.log(`✓ @${info.username} (id ${info.id}) is live. Send /start in Telegram.`);
  },
});
