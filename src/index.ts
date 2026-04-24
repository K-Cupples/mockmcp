import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildMcpServer } from "./mcp-server.js";
import {
  buildRateLimiter,
  fingerprint,
  buildLimitExceededBody,
  rateLimitHeaders,
} from "./rate-limit.js";

// Static landing files live outside the compiled src/ tree.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LANDING_DIR = path.resolve(__dirname, "..", "landing");

// MCP Streamable HTTP sessions are identified by the `Mcp-Session-Id` header
// after an `initialize` request. One transport per session.
const sessions = new Map<string, StreamableHTTPServerTransport>();

const rateLimiter = buildRateLimiter();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type, Mcp-Session-Id, Authorization, Accept",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

const server = createServer(async (req, res) => {
  // Always attach CORS headers.
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);

  const url = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? "localhost"}`,
  );
  const method = req.method ?? "GET";

  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Content-type negotiated API discovery: if a client (or agent) hits /
  // expecting JSON, hand back the machine-readable manifest.
  if (url.pathname === "/" && method === "GET") {
    const accept = req.headers.accept ?? "";
    if (accept.includes("application/json") && !accept.includes("text/html")) {
      return writeJson(res, 200, {
        name: "MockMCP",
        description:
          "Hosted MCP endpoint returning realistic fake data for prototyping agents.",
        endpoint: "/mcp",
        docs: "https://mockmcp.io",
      });
    }
    return serveStatic(res, "index.html", "text/html; charset=utf-8");
  }

  if (url.pathname === "/waitlist" && method === "GET") {
    return serveStatic(res, "waitlist.html", "text/html; charset=utf-8");
  }

  if (url.pathname === "/favicon.svg" && method === "GET") {
    return serveStatic(res, "favicon.svg", "image/svg+xml");
  }

  if (url.pathname === "/api/waitlist" && method === "POST") {
    return handleWaitlist(req, res);
  }

  if (url.pathname === "/health" && method === "GET") {
    return writeJson(res, 200, { ok: true });
  }

  if (url.pathname === "/mcp") {
    return handleMcp(req, res);
  }

  writeJson(res, 404, { error: "Not found" });
});

async function serveStatic(
  res: ServerResponse,
  filename: string,
  contentType: string,
) {
  try {
    const content = await readFile(path.join(LANDING_DIR, filename));
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=300",
    });
    res.end(content);
  } catch {
    writeJson(res, 404, { error: "Not found" });
  }
}

async function handleWaitlist(req: IncomingMessage, res: ServerResponse) {
  const body = (await collectJsonBody(req)) as { email?: string } | undefined;
  const email = body?.email?.toString().trim().toLowerCase();
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    return writeJson(res, 400, { error: "Valid email required." });
  }
  // V1: log to stdout so Railway surfaces it. Real storage (Resend list, DB,
  // Tally forward) lands when the paid tier is close to live.
  console.log(
    JSON.stringify({
      event: "waitlist_signup",
      email,
      at: new Date().toISOString(),
    }),
  );
  writeJson(res, 200, { ok: true });
}

async function handleMcp(req: IncomingMessage, res: ServerResponse) {
  // Rate-limit every request to /mcp (POST initializes/calls, GET streams,
  // DELETE closes). Each round trip to the endpoint counts.
  const fp = fingerprint(req);
  const decision = await rateLimiter.check(fp);

  // Always surface the limit state to cooperative clients.
  for (const [k, v] of Object.entries(rateLimitHeaders(decision))) {
    res.setHeader(k, v);
  }

  if (!decision.ok) {
    const retryAfter = Math.max(
      1,
      Math.ceil((decision.resetAt - Date.now()) / 1000),
    );
    res.setHeader("Retry-After", String(retryAfter));
    return writeJson(res, 429, buildLimitExceededBody(decision));
  }

  const sessionIdHeader = req.headers["mcp-session-id"];
  const sessionId = Array.isArray(sessionIdHeader)
    ? sessionIdHeader[0]
    : sessionIdHeader;

  let transport: StreamableHTTPServerTransport | undefined;

  if (sessionId && sessions.has(sessionId)) {
    transport = sessions.get(sessionId);
  } else if (!sessionId && req.method === "POST") {
    // First request of a new session. Transport assigns the session id on
    // successful `initialize` and stores itself in our registry.
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        if (transport) sessions.set(id, transport);
      },
    });
    transport.onclose = () => {
      const id = transport?.sessionId;
      if (id) sessions.delete(id);
    };
    const mcp = buildMcpServer();
    await mcp.connect(transport);
  } else {
    return writeJson(res, 400, {
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "No valid session. Send an `initialize` request first.",
      },
      id: null,
    });
  }

  if (!transport) {
    return writeJson(res, 500, { error: "Transport unavailable" });
  }

  const body = await collectJsonBody(req);
  await transport.handleRequest(req, res, body);
}

async function collectJsonBody(req: IncomingMessage): Promise<unknown> {
  if (req.method !== "POST") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return undefined;
  }
}

function writeJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`MockMCP listening on http://localhost:${port}`);
  console.log(`  - MCP endpoint: http://localhost:${port}/mcp`);
});
