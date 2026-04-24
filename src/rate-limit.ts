import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// Free-tier limits. Tuned for prototyping: generous enough that individual
// devs testing agents won't hit them, low enough that CI/eval pipelines will.
const FREE_PER_MINUTE = 30;
const FREE_PER_DAY = 500;

const UPGRADE_URL = "https://mockmcp.io/waitlist";

// Hash ip + user-agent so we never log raw IPs. SHA-256, first 16 hex chars.
// Good enough as a fingerprint without being identifying PII.
export function fingerprint(req: IncomingMessage): string {
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0] ??
    req.socket.remoteAddress ??
    "unknown";
  const ua = (req.headers["user-agent"] as string | undefined) ?? "unknown";
  return createHash("sha256").update(`${ip}::${ua}`).digest("hex").slice(0, 16);
}

export type RateLimitDecision = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // epoch ms when the current window rolls over
  scope: "minute" | "day";
};

export interface RateLimiter {
  check(key: string): Promise<RateLimitDecision>;
}

class UpstashRateLimiter implements RateLimiter {
  private minute: Ratelimit;
  private day: Ratelimit;

  constructor(redis: Redis) {
    this.minute = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(FREE_PER_MINUTE, "1 m"),
      prefix: "mockmcp:rl:min",
      analytics: true,
    });
    this.day = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(FREE_PER_DAY, "1 d"),
      prefix: "mockmcp:rl:day",
      analytics: true,
    });
  }

  async check(key: string): Promise<RateLimitDecision> {
    const [m, d] = await Promise.all([
      this.minute.limit(key),
      this.day.limit(key),
    ]);
    // If either window is exhausted, return whichever will unblock later so
    // Retry-After reflects the real wait.
    if (!m.success || !d.success) {
      const scope = !d.success ? "day" : "minute";
      const target = !d.success ? d : m;
      return {
        ok: false,
        limit: target.limit,
        remaining: target.remaining,
        resetAt: target.reset,
        scope,
      };
    }
    return {
      ok: true,
      limit: m.limit,
      remaining: m.remaining,
      resetAt: m.reset,
      scope: "minute",
    };
  }
}

// In-memory fallback so local dev works without Upstash credentials.
// Each process has its own counters — fine for a single dev machine.
class InMemoryRateLimiter implements RateLimiter {
  private minuteBuckets = new Map<string, { count: number; resetAt: number }>();
  private dayBuckets = new Map<string, { count: number; resetAt: number }>();

  async check(key: string): Promise<RateLimitDecision> {
    const now = Date.now();
    const minuteState = this.tick(
      this.minuteBuckets,
      key,
      now,
      60_000,
      FREE_PER_MINUTE,
    );
    const dayState = this.tick(
      this.dayBuckets,
      key,
      now,
      86_400_000,
      FREE_PER_DAY,
    );
    if (!minuteState.ok || !dayState.ok) {
      const blocked = !dayState.ok ? dayState : minuteState;
      const scope = !dayState.ok ? "day" : "minute";
      return { ...blocked, scope };
    }
    return { ...minuteState, scope: "minute" };
  }

  private tick(
    bucket: Map<string, { count: number; resetAt: number }>,
    key: string,
    now: number,
    windowMs: number,
    limit: number,
  ): Omit<RateLimitDecision, "scope"> {
    const entry = bucket.get(key);
    if (!entry || entry.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      bucket.set(key, fresh);
      return { ok: true, limit, remaining: limit - 1, resetAt: fresh.resetAt };
    }
    entry.count += 1;
    const ok = entry.count <= limit;
    return {
      ok,
      limit,
      remaining: Math.max(0, limit - entry.count),
      resetAt: entry.resetAt,
    };
  }
}

export function buildRateLimiter(): RateLimiter {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    const redis = new Redis({ url, token });
    console.log("Rate limiter: Upstash Redis");
    return new UpstashRateLimiter(redis);
  }
  console.log(
    "Rate limiter: in-memory fallback (set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN for production)",
  );
  return new InMemoryRateLimiter();
}

// Standard 429 body. Includes a machine-readable upgrade hint so agents or
// users who hit the wall can see where to go next.
export function buildLimitExceededBody(decision: RateLimitDecision) {
  return {
    jsonrpc: "2.0",
    error: {
      code: -32029,
      message:
        decision.scope === "day"
          ? `Free tier daily limit reached (${decision.limit}/day). Drop your email for early paid-tier access: ${UPGRADE_URL}`
          : `Free tier per-minute limit reached (${decision.limit}/min). Slow down or grab paid-tier access: ${UPGRADE_URL}`,
      data: {
        retry_after_seconds: Math.max(
          1,
          Math.ceil((decision.resetAt - Date.now()) / 1000),
        ),
        limit: decision.limit,
        scope: decision.scope,
        upgrade_url: UPGRADE_URL,
      },
    },
    id: null,
  };
}

export function rateLimitHeaders(decision: RateLimitDecision) {
  return {
    "X-RateLimit-Limit": String(decision.limit),
    "X-RateLimit-Remaining": String(decision.remaining),
    "X-RateLimit-Reset": String(Math.floor(decision.resetAt / 1000)),
    "X-RateLimit-Scope": decision.scope,
  };
}
