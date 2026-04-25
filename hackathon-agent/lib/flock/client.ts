// Flock.io chat client. Auth quirk: Flock uses `x-litellm-api-key` header
// (non-standard). We send both that header and a Bearer token so whichever Flock
// honors works.
const baseUrl = process.env.FLOCK_BASE_URL ?? "https://api.flock.io/v1";
const apiKey = process.env.FLOCK_API_KEY;
const model = process.env.FLOCK_MODEL ?? "qwen3-30b-a3b-instruct-2507";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function flockChat(
  messages: ChatMessage[],
  opts?: { temperature?: number; jsonMode?: boolean },
): Promise<string> {
  if (!apiKey) {
    throw new Error("FLOCK_API_KEY missing");
  }
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-litellm-api-key": apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts?.temperature ?? 0.3,
      response_format: opts?.jsonMode ? { type: "json_object" } : undefined,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`flock ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return json.choices[0]?.message?.content ?? "";
}
