import { Bot } from "grammy";
import { onStart, onHelp, onCriteria, onWatch, onRefresh, onText, onCallback } from "./handlers";

let bot: Bot | null = null;

function getBot(): Bot {
  if (bot) return bot;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN missing");
  const b = new Bot(token);
  b.command("start", onStart);
  b.command("help", onHelp);
  b.command("criteria", onCriteria);
  b.command("watch", onWatch);
  b.command("refresh", onRefresh);
  b.on("callback_query:data", onCallback);
  b.on("message:text", onText);
  bot = b;
  return b;
}

export async function handleUpdate(update: unknown) {
  await getBot().handleUpdate(update as Parameters<Bot["handleUpdate"]>[0]);
}
