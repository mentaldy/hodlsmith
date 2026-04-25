import type { BagCheckResult } from "@/lib/bagcheck";

type ChatState = {
  wallet?: string;
  watchedChain?: string;
  lastCheck?: BagCheckResult;
  lastCheckAt?: number;
};

const states = new Map<number, ChatState>();

export function getChat(chatId: number): ChatState {
  let s = states.get(chatId);
  if (!s) {
    s = {};
    states.set(chatId, s);
  }
  return s;
}

export function setChat(chatId: number, patch: Partial<ChatState>) {
  const s = getChat(chatId);
  Object.assign(s, patch);
}
