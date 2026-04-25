"""Thin Nansen API client + tool definitions for the agent.

Scope is intentionally narrow: 3 endpoints that together answer almost any
'what is Smart Money doing on Base right now' question. Each tool returns
trimmed JSON to keep LLM context small.

Docs: https://docs.nansen.ai/getting-started/api-structure-and-base-url
Auth header: `apikey: <key>` (lowercase). Base URL: https://api.nansen.ai/api/v1
"""

from __future__ import annotations

import json
import os
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.environ["NANSEN_API_KEY"]
BASE_URL = os.environ.get("NANSEN_BASE_URL", "https://api.nansen.ai/api/v1").rstrip("/")

_HEADERS = {"Content-Type": "application/json", "apikey": API_KEY}
_DEFAULT_PAGE = {"page": 1, "per_page": 10}


def _post(path: str, body: dict[str, Any]) -> Any:
    url = f"{BASE_URL}/{path.lstrip('/')}"
    r = requests.post(url, headers=_HEADERS, json=body, timeout=30)
    if not r.ok:
        return {"error": f"HTTP {r.status_code}", "body": r.text[:500]}
    try:
        return r.json()
    except ValueError:
        return {"error": "non-json response", "body": r.text[:500]}


def smart_money_dex_trades(chain: str = "base", limit: int = 10) -> Any:
    """Recent (last 24h) DEX trades by Smart Money on the given chain."""
    return _post(
        "smart-money/dex-trades",
        {"chains": [chain], "pagination": {"page": 1, "per_page": limit}},
    )


def smart_money_holdings(chain: str = "base", limit: int = 10) -> Any:
    """Aggregated current Smart Money token holdings on the given chain."""
    return _post(
        "smart-money/holdings",
        {"chains": [chain], "pagination": {"page": 1, "per_page": limit}},
    )


def token_screener(chain: str = "base", limit: int = 10) -> Any:
    """Trending tokens on the given chain (volume, holders, smart-money interest)."""
    return _post(
        "tgm/token-screener",
        {"chains": [chain], "pagination": {"page": 1, "per_page": limit}},
    )


# ---- OpenAI tool-calling schema ----

TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "smart_money_dex_trades",
            "description": (
                "Recent DEX trades by Smart Money wallets in the last 24h. "
                "Use to answer 'what did smart money just buy/sell on <chain>'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "chain": {
                        "type": "string",
                        "description": "Chain id, default 'base'.",
                        "default": "base",
                    },
                    "limit": {"type": "integer", "default": 10, "minimum": 1, "maximum": 50},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "smart_money_holdings",
            "description": (
                "Aggregated current token holdings of Smart Money wallets, with 24h change. "
                "Use to answer 'what does smart money currently hold on <chain>'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "chain": {"type": "string", "default": "base"},
                    "limit": {"type": "integer", "default": 10, "minimum": 1, "maximum": 50},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "token_screener",
            "description": (
                "Trending tokens on the given chain by volume, holders, and smart-money interest. "
                "Use to answer 'what tokens are hot on <chain> right now'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "chain": {"type": "string", "default": "base"},
                    "limit": {"type": "integer", "default": 10, "minimum": 1, "maximum": 50},
                },
            },
        },
    },
]

DISPATCH = {
    "smart_money_dex_trades": smart_money_dex_trades,
    "smart_money_holdings": smart_money_holdings,
    "token_screener": token_screener,
}


def call_tool(name: str, arguments: str | dict[str, Any]) -> str:
    """Run a tool by name with stringified or dict args; return JSON string for the LLM."""
    if name not in DISPATCH:
        return json.dumps({"error": f"unknown tool: {name}"})
    args = json.loads(arguments) if isinstance(arguments, str) else arguments
    try:
        result = DISPATCH[name](**args)
    except Exception as e:  # noqa: BLE001 — surface to LLM
        return json.dumps({"error": f"{type(e).__name__}: {e}"})
    return json.dumps(result, default=str)[:8000]  # keep LLM context small
