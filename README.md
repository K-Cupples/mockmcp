# MockMCP

Hosted MCP endpoint returning realistic fake data for prototyping agents.

## What it is

Paste one config snippet into Claude Code, Claude Desktop, or Cursor. Connect to `https://mockmcp.io/mcp`. Call pre-built tools. Get realistic fake data back. No signup, no config.

Built for devs who want to prototype agent workflows without wiring up a real backend.

## Tools (V1)

- `list_users`, `get_user`, `create_user`
- `list_products`, `get_product` *(coming)*
- `list_orders`, `get_order`, `create_order` *(coming)*
- `list_events`, `create_event` *(coming)*
- `send_email` *(coming — returns fake success)*
- `search_knowledge_base` *(coming)*

Covers the tools in 90% of agent tutorials.

## Run locally

```bash
npm install
npm run dev
```

Server listens on `http://localhost:3000`. MCP endpoint at `/mcp`.

## Test with curl

```bash
# Initialize a session (returns an Mcp-Session-Id header)
curl -i -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-06-18",
      "capabilities": {},
      "clientInfo": { "name": "curl", "version": "0.1" }
    }
  }'

# Use the Mcp-Session-Id from the response above for subsequent calls:
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: <paste-id-here>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": { "name": "list_users", "arguments": { "limit": 3 } }
  }'
```

## Connect from Claude Code

```bash
claude mcp add --transport http mockmcp https://mockmcp.io/mcp
```

## Deploy (Railway)

Targets Node 20+. Build + start are pinned via `nixpacks.toml`; health checks + restart policy via `railway.json`.

### One-time setup

1. Push this repo to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo** → pick `mockmcp`.
3. Railway reads `nixpacks.toml` and `railway.json`, runs `npm ci → npm run build → node dist/index.js`.
4. Once the deploy goes green, add your custom domain:
   - Railway → service → **Settings → Networking → Custom Domain** → `mockmcp.io`
   - Follow Railway's DNS instructions at Namecheap (CNAME to `<your-app>.up.railway.app` for the `www`, or use Railway's ALIAS/A record for the apex).

### Environment variables (set in Railway → Variables)

| Var | Required | Why |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | Yes in prod | Rate limiter backing store. Without it, MockMCP falls back to an in-memory limiter that's per-instance — fine for a single dyno, not for scale. |
| `UPSTASH_REDIS_REST_TOKEN` | Yes in prod | Same. Create a free Upstash Redis instance at upstash.com and paste both values. |
| `PORT` | Auto | Railway sets this. The server reads `process.env.PORT`. |

### Health check

`GET /health` returns `{"ok":true}`. Railway pings this during deploy. If the app doesn't respond within 30s, the deploy fails and Railway keeps the previous version live.

### Waitlist signups

`POST /api/waitlist` logs a structured JSON line per signup:

```json
{"event":"waitlist_signup","email":"alice@example.com","at":"2026-04-24T19:33:06.396Z"}
```

View these in Railway → Deployments → Logs, or grep the log stream with `railway logs | grep waitlist_signup`. Real storage (Resend list, DB, Tally forward) goes in when the paid tier launches.
