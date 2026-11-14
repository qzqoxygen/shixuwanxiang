import "server-only";
import { createHash } from "node:crypto";

// Only trust a proxy that replaces the header and is the application's sole public ingress.
// These short-lived guards are per warm function instance, and never store prompts or answers.
const clients = new Map<string, {
  reset: number;
  count: number;
  requests: Map<string, number>;
}>();
const windowMs = 60_000;
let nextCleanup = 0;

export function beginAiRequest(request: Request, route: "chat" | "studio" | "season-guide", content: string):
  { status: number; code: string; message: string } | { finish(): void } {
  const now = Date.now();
  if (now >= nextCleanup) {
    for (const [key, client] of clients) {
      if (now >= client.reset + 2 * windowMs) clients.delete(key);
    }
    nextCleanup = now + windowMs;
  }
  const id = request.headers.get("Idempotency-Key");
  if (id !== null && !/^[a-zA-Z0-9-]{1,64}$/.test(id)) {
    return { status: 400, code: "INVALID_REQUEST_ID", message: "请求标识无效，请重新发送。" } as const;
  }
  const trustedIngress = process.env.VERCEL === "1" || process.env.SHIXU_TRUST_PROXY === "1";
  const address = process.env.SHIXU_TRUST_NETLIFY === "1"
    ? request.headers.get("x-nf-client-connection-ip")?.trim()
    : trustedIngress ? request.headers.get("x-forwarded-for")?.split(",")[0].trim() : undefined;
  const key = address || "local";
  const client = clients.get(key) ?? { reset: now + windowMs, count: 0, requests: new Map<string, number>() };
  if (now >= client.reset) {
    client.reset = now + windowMs;
    client.count = 0;
  }
  for (const [attempt, expires] of client.requests) {
    if (expires <= now) client.requests.delete(attempt);
  }
  // Older clients without a request ID still get protection while an identical call is in flight.
  const attempt = route + ":" + (id ?? createHash("sha256").update(content).digest("hex"));
  if (client.requests.has(attempt)) {
    return { status: 409, code: "DUPLICATE_REQUEST", message: "这次请求已受理，请勿重复提交。" } as const;
  }
  if (client.count >= 12 || (!clients.has(key) && clients.size >= 4096)) {
    return { status: 429, code: "ACCESS_RATE_LIMITED", message: "请求较频繁，请稍等一分钟再试。" } as const;
  }
  clients.set(key, client);
  client.count++;
  client.requests.set(attempt, now + 2 * windowMs);
  return { finish() { if (!id) client.requests.delete(attempt); } };
}
