# MockMCP

> Hosted MCP endpoint returning realistic fake data for prototyping agents. Paste one URL, zero setup.

**Live at [mockmcp.io](https://mockmcp.io)** — `https://mockmcp.io/mcp`

Built for devs who want to prototype agent workflows without wiring up a backend, writing fixtures, or standing up a local MCP server. 12 pre-built tools covering the scenarios in most agent tutorials.

## Try it

```bash
# Initialize a session and get back a session id
curl -i -X POST https://mockmcp.io/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0.1"}}}'

# Use the Mcp-Session-Id header in subsequent calls:
curl -X POST https://mockmcp.io/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: <paste-id-here>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_users","arguments":{"limit":3}}}'
```

## Connect your client

**Claude Code**

```bash
claude mcp add --transport http mockmcp https://mockmcp.io/mcp
```

**Cursor** — add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "mockmcp": {
      "url": "https://mockmcp.io/mcp"
    }
  }
}
```

**Claude Desktop** — Settings → Connectors → Add custom connector → paste `https://mockmcp.io/mcp` as the URL.

No `mcp-remote` proxy required. All three clients speak Streamable HTTP natively.

## Tools

| Tool | What it does |
|---|---|
| `list_users` | Paginated list of mock users |
| `get_user` | One mock user by id or seed |
| `create_user` | Create a mock user (no persistence) |
| `list_products` | Paginated list of mock products |
| `get_product` | One mock product |
| `list_orders` | Mock orders with optional status filter |
| `get_order` | One mock order |
| `create_order` | Create a mock order (no persistence) |
| `list_events` | Mock analytics events |
| `create_event` | Record a mock event |
| `send_email` | Returns fake success, nothing delivered |
| `search_knowledge_base` | Mock KB search with ranked results |

All data is seeded from your inputs — same input, same output.

## Limits

Free tier, per hashed `IP + User-Agent` fingerprint:

- **30 requests per minute**
- **500 requests per day**

Hit the wall? Drop your email at [mockmcp.io/waitlist](https://mockmcp.io/waitlist) for paid-tier access when it launches.

429 responses carry a structured JSON-RPC error with `upgrade_url` and `retry_after_seconds`. Every successful response carries `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `X-RateLimit-Scope` headers.

## Run locally

```bash
npm install
npm run dev
```

Server listens on `http://localhost:3000`. MCP endpoint at `/mcp`. Without Upstash env vars, rate limiting falls back to an in-memory store (per-process, fine for dev).

## Stack

- [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) — MCP server + Streamable HTTP transport
- Raw Node `http` — no framework overhead, clean shutdown
- [`@faker-js/faker`](https://fakerjs.dev) — deterministic fake data via seeds
- [`@upstash/ratelimit`](https://github.com/upstash/ratelimit-js) + `@upstash/redis` — sliding-window rate limiting
- [`zod`](https://zod.dev) — tool input validation

## Deploy (for forks)

Targets Node 20+. Build + start are pinned via `nixpacks.toml`; health checks + restart policy via `railway.json`.

1. Fork this repo, push to GitHub.
2. Railway → New Project → Deploy from GitHub → pick your fork.
3. Add env vars in Railway → Variables:

| Var | Notes |
|---|---|
| `UPSTASH_REDIS_REST_URL` | From [upstash.com](https://upstash.com) free tier |
| `UPSTASH_REDIS_REST_TOKEN` | Paired with the URL above |
| `PORT` | Railway sets this automatically |

4. Railway service → Settings → Networking → Custom Domain → paste your domain → follow the DNS instructions.

### Health check

`GET /health` returns `{"ok":true}`. Railway pings this during deploy.

### Waitlist signups

`POST /api/waitlist` logs a structured JSON line per signup:

```json
{"event":"waitlist_signup","email":"alice@example.com","at":"2026-04-24T19:33:06.396Z"}
```

Grep them with `railway logs | grep waitlist_signup`. Storage-free by design — swap in Resend, a Tally forward, or a DB when the paid tier is live.

## License

MIT — see [LICENSE](./LICENSE).
