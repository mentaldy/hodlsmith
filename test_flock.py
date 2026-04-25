"""Smoke test: does Flock LLM respond? Run this BEFORE building the agent.

Why: if anything breaks tomorrow, this isolates 'is the LLM provider up?' from
'is my agent code broken?'. Flock uses a non-standard `x-litellm-api-key`
header, so we exercise that path explicitly.
"""

import os
import sys

import requests
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

API_KEY = os.environ["FLOCK_API_KEY"]
BASE_URL = os.environ.get("FLOCK_BASE_URL", "https://api.flock.io/v1")
MODEL = os.environ.get("FLOCK_MODEL", "qwen3-30b-a3b-instruct-2507")


def via_raw_requests() -> str:
    """Mirror the curl example in Flock docs verbatim — ground truth."""
    r = requests.post(
        f"{BASE_URL}/chat/completions",
        headers={
            "Content-Type": "application/json",
            "x-litellm-api-key": API_KEY,
        },
        json={
            "model": MODEL,
            "messages": [{"role": "user", "content": "한 줄로 자기소개 해줘."}],
        },
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


def via_openai_sdk() -> str:
    """How the agent will actually call Flock. Sends both Bearer + custom header
    so whichever Flock honors will work."""
    client = OpenAI(
        api_key=API_KEY,
        base_url=BASE_URL,
        default_headers={"x-litellm-api-key": API_KEY},
    )
    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": "한 줄로 자기소개 해줘."}],
    )
    return resp.choices[0].message.content or ""


if __name__ == "__main__":
    print(f"[config] base_url={BASE_URL} model={MODEL}")

    print("\n[1/2] raw requests + x-litellm-api-key header ...")
    try:
        print("  →", via_raw_requests())
    except Exception as e:
        print(f"  ✗ raw requests path failed: {e}")
        sys.exit(1)

    print("\n[2/2] openai SDK + base_url override ...")
    try:
        print("  →", via_openai_sdk())
    except Exception as e:
        print(f"  ✗ openai SDK path failed: {e}")
        sys.exit(2)

    print("\n✓ Flock reachable both ways. Safe to build the agent on the SDK path.")
