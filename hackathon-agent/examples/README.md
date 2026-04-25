# Hodlsmith examples

Runnable demonstrations of the agent. All examples assume you have:

1. Cloned the repo
2. Run `npm install` in `hackathon-agent/`
3. Configured `.env.local` (copy from `.env.example`)

## Examples

| File | What it shows |
|---|---|
| [`import-as-library.ts`](import-as-library.ts) | Programmatic use of `runBagCheck()` — the agent core, no Telegram involved. The base for any custom surface (Slack, MCP, dashboard, etc.) |

## Run

```bash
npx tsx --env-file=.env.local examples/import-as-library.ts
```

## Coming soon

- `slack-bot.ts` — `/bagcheck` command for Slack workspaces
- `mcp-server.ts` — expose `bag_check` as an MCP tool for Claude/GPT/Cursor
- `discord-bot.ts` — Discord slash command surface
