import "server-only";
import { setTimeout as wait } from "node:timers/promises";
import OpenAI from "openai";
import type { CompletionParams } from "@/lib/ai-agent";

export const DEEPSEEK_MODEL = "deepseek-flash";
export const AI_REQUEST_TIMEOUT_MS = 52_000;

export function createDeepSeekClient(apiKey: string) {
  return new OpenAI({
    baseURL: "https://api.deepseek.com",
    apiKey,
    timeout: 40_000,
    maxRetries: 0,
    logLevel: "off",
    // The SDK also loads ambient OpenAI headers. Send only our DeepSeek credentials.
    fetch: (url, init) => fetch(url, {
      ...init, cache: "no-store", redirect: "error",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    }),
  });
}

class InvalidCompletionError extends Error {}

export async function completeDeepSeek(client: OpenAI, params: CompletionParams, signal: AbortSignal) {
  const request = () => {
    signal.throwIfAborted();
    return client.chat.completions.create(params, { signal });
  };
  let completion;
  try {
    completion = await request();
  } catch (error) {
    // Only a positive rate-limit rejection is safe to replay. Honor long waits by returning 429.
    if (!(error instanceof OpenAI.APIError) || error.status !== 429) throw error;
    const retryAfter = error.headers?.get("retry-after");
    let delay = 500;
    if (retryAfter) {
      delay = /^\d+(?:\.\d+)?$/.test(retryAfter) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now();
      if (!Number.isFinite(delay) || delay > 2000) throw error;
    }
    await wait(Math.max(0, delay), undefined, { signal });
    completion = await request();
  }
  if (!Array.isArray(completion?.choices)) throw new InvalidCompletionError();
  return completion;
}

const errors = {
  TIMEOUT: { status: 504, message: "DeepSeek 响应超时，请稍后重试。" },
  CANCELLED: { status: 408, message: "请求已取消，可重新发送。" },
  NETWORK_ERROR: { status: 502, message: "暂时连不上 DeepSeek，请检查服务器网络后重试。" },
  API_KEY_INVALID: { status: 401, message: "DeepSeek 身份验证失败，请联系管理员检查服务端密钥。" },
  INSUFFICIENT_BALANCE: { status: 402, message: "DeepSeek 账户余额不足，请联系管理员检查额度。" },
  ACCESS_DENIED: { status: 503, message: "DeepSeek 拒绝了此次调用，请联系管理员检查账户权限。" },
  RATE_LIMITED: { status: 429, message: "DeepSeek 请求频繁，请稍后重试。" },
  MODEL_UNAVAILABLE: { status: 503, message: "DeepSeek 模型暂不可用，请稍后重试。" },
  PROVIDER_REQUEST_ERROR: { status: 502, message: "DeepSeek 未接受请求参数，请联系管理员检查服务端配置。" },
  PROVIDER_UNAVAILABLE: { status: 502, message: "DeepSeek 服务暂时不可用，请稍后重试。" },
  INVALID_RESPONSE: { status: 502, message: "DeepSeek 未返回可用内容，请重试。" },
  INTERNAL_ERROR: { status: 500, message: "AI 服务暂时出现异常，请稍后重试。" },
} as const;

const httpErrors: Partial<Record<number, keyof typeof errors>> = {
  400: "PROVIDER_REQUEST_ERROR", 401: "API_KEY_INVALID", 402: "INSUFFICIENT_BALANCE", 403: "ACCESS_DENIED",
  404: "MODEL_UNAVAILABLE", 408: "TIMEOUT", 422: "PROVIDER_REQUEST_ERROR", 429: "RATE_LIMITED",
  503: "MODEL_UNAVAILABLE", 504: "TIMEOUT",
};

export function classifyDeepSeekError(error: unknown, signal?: AbortSignal) {
  let code: keyof typeof errors;
  if (signal?.aborted) code = signal.reason?.name === "TimeoutError" ? "TIMEOUT" : "CANCELLED";
  else if (error instanceof OpenAI.APIConnectionTimeoutError) code = "TIMEOUT";
  else if (error instanceof OpenAI.APIUserAbortError) code = "CANCELLED";
  else if (error instanceof OpenAI.APIConnectionError) code = "NETWORK_ERROR";
  else if (error instanceof OpenAI.APIError) code = httpErrors[error.status ?? 0] ?? "PROVIDER_UNAVAILABLE";
  else if (error instanceof SyntaxError || error instanceof InvalidCompletionError) code = "INVALID_RESPONSE";
  else code = "INTERNAL_ERROR";
  return { code, ...errors[code] };
}

const logCodes = new Set([
  ...Object.keys(errors), "API_KEY_MISSING", "TOOLS_UNAVAILABLE", "TOOL_ROUND_LIMIT", "TOO_MANY_TOOL_CALLS",
  "INVALID_TOOL_RESPONSE", "SEARCH_KEY_MISSING", "SEARCH_AUTH_FAILED", "SEARCH_INSUFFICIENT_BALANCE",
  "SEARCH_TIMEOUT", "SEARCH_RATE_LIMITED", "SEARCH_FAILED", "SEARCH_INVALID_RESPONSE", "SEARCH_EMPTY",
  "SEARCH_ANSWER_UNSUPPORTED", "UNVERIFIED_ANSWER", "CASE_ANSWER_UNSUPPORTED", "INVALID_MAP_ACTIONS", "INVALID_WEB_SELECTION", "EVIDENCE_MISMATCH", "UNAPPLIED_MAP_CLAIM",
]);

export function logAiError(scope: "chat" | "studio" | "search" | "season-guide" | "visit", code: string, status: number) {
  console.warn("[ai]", { scope, code: logCodes.has(code) ? code : "INTERNAL_ERROR", status });
}
