"""Base Smart Money intel agent — Flock LLM + Nansen tools, CLI REPL.

Run: `uv run python agent.py`. Type a question, get a Smart-Money-aware answer.
Type 'exit' or Ctrl-D to leave.

Architecture: standard OpenAI-compatible tool-calling loop.
  user → LLM → (optional tool_calls) → run tools → feed results → LLM → final
  Loops until the model returns a message with no tool_calls.
"""

from __future__ import annotations

import json
import os
import sys

from dotenv import load_dotenv
from openai import OpenAI

import nansen

load_dotenv()

FLOCK_API_KEY = os.environ["FLOCK_API_KEY"]
FLOCK_BASE_URL = os.environ.get("FLOCK_BASE_URL", "https://api.flock.io/v1")
FLOCK_MODEL = os.environ.get("FLOCK_MODEL", "qwen3-30b-a3b-instruct-2507")

SYSTEM_PROMPT = """You are a Base-chain Smart Money intelligence analyst.

You have tools that query Nansen for what 'Smart Money' wallets (vetted profitable
traders + funds) are doing on the Base chain. Default chain is 'base' unless the
user names another EVM chain. When you call a tool, summarise the result for a
trader: name the tokens, the direction (buy/sell), magnitude, and any obvious
signal. Cite raw numbers. Be concise — a few bullet points beats a wall of text.

If a tool returns an error, tell the user plainly what failed and stop — do not
hallucinate data.
"""

# Flock's docs use a non-standard `x-litellm-api-key` header. We send BOTH that
# header and the standard Bearer token so whichever Flock honors works.
client = OpenAI(
    api_key=FLOCK_API_KEY,
    base_url=FLOCK_BASE_URL,
    default_headers={"x-litellm-api-key": FLOCK_API_KEY},
)


def chat_once(history: list[dict]) -> str:
    """Run one user-turn through the tool-calling loop. Returns final assistant text."""
    while True:
        resp = client.chat.completions.create(
            model=FLOCK_MODEL,
            messages=history,
            tools=nansen.TOOLS,
            tool_choice="auto",
        )
        msg = resp.choices[0].message

        # Append the assistant message verbatim so subsequent tool messages
        # have a tool_call_id to attach to.
        history.append(msg.model_dump(exclude_none=True))

        if not msg.tool_calls:
            return msg.content or ""

        for call in msg.tool_calls:
            result = nansen.call_tool(call.function.name, call.function.arguments)
            history.append(
                {
                    "role": "tool",
                    "tool_call_id": call.id,
                    "name": call.function.name,
                    "content": result,
                }
            )


def repl() -> None:
    history: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    print(f"[ready] model={FLOCK_MODEL}  tools={[t['function']['name'] for t in nansen.TOOLS]}")
    print("Ask anything about Base Smart Money. 'exit' to quit.\n")

    while True:
        try:
            user = input("you ▸ ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return
        if not user:
            continue
        if user.lower() in {"exit", "quit"}:
            return

        history.append({"role": "user", "content": user})
        try:
            answer = chat_once(history)
        except Exception as e:  # noqa: BLE001
            print(f"\n[error] {type(e).__name__}: {e}\n", file=sys.stderr)
            history.pop()  # don't poison history with the failed turn
            continue
        print(f"\nagent ▸ {answer}\n")


if __name__ == "__main__":
    repl()
