import OpenAI from "openai";
import { MAX_BODY_BYTES, validateMessages } from "@/lib/chat";
import { AgentError, runChatAgent } from "@/lib/ai-agent";

// Use the default Node.js runtime; explicit runtime config conflicts with Cache Components.

class BodyTooLargeError extends Error {}

async function readBody(request: Request): Promise<unknown> {
  // Enforce the limit even when Content-Length is omitted or incorrect.
  const reader = request.body?.getReader();
  if (!reader) throw new Error("请求正文不能为空。");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new BodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
}

export async function POST(request: Request) {
  function failure(status: number, code: string, message: string) {
    return Response.json({ answer: null, truncated: false, error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
  }
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const source = new URL(origin);
      // Next.js can normalize request.url to localhost even when the browser uses
      // 127.0.0.1. Host preserves the address actually requested by the browser.
      const host = request.headers.get("host") ?? new URL(request.url).host;
      if (!["http:", "https:"].includes(source.protocol) || source.host !== host) {
        return failure(403, "INVALID_ORIGIN", "请从本站页面发送聊天请求。");
      }
    } catch {
      return failure(403, "INVALID_ORIGIN", "请从本站页面发送聊天请求。");
    }
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return failure(415, "INVALID_CONTENT_TYPE", "请求格式必须为 JSON。");
  }
  let body: unknown;
  try { body = await readBody(request); }
  catch (error) {
    return error instanceof BodyTooLargeError
      ? failure(413, "BODY_TOO_LARGE", "请求过大，请缩短问题或清空对话。")
      : failure(400, "INVALID_JSON", "请求不是有效的 JSON 消息。");
  }
  let messages;
  try {
    messages = validateMessages(body);
  }
  catch (error) { return failure(400, "INVALID_INPUT", error instanceof Error ? error.message : "消息格式无效。"); }

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return failure(503, "API_KEY_MISSING", "尚未配置 OpenRouter 密钥。请在服务端 .env.local 设置 OPENROUTER_API_KEY 后重启服务。");

  const deadline = AbortSignal.timeout(120_000);
  const signal = AbortSignal.any([request.signal, deadline]);
  try {
    const client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
      timeout: 45_000,
      maxRetries: 0,
      logLevel: "off",
    });
    const result = await runChatAgent((params) => client.chat.completions.create(params, { signal }), messages);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // Never log or return raw provider errors, request headers or credentials.
    if (deadline.aborted) return failure(504, "TIMEOUT", "本次文化问答等待超时，请稍后重试。");
    if (error instanceof AgentError) return failure(502, error.code, error.message);
    if (error instanceof OpenAI.APIConnectionTimeoutError) return failure(504, "TIMEOUT", "OpenRouter 响应超时，请稍后重试。");
    if (error instanceof OpenAI.APIConnectionError) return failure(502, "NETWORK_ERROR", "暂时无法连接 OpenRouter，请检查服务器网络后重试。");
    if (error instanceof OpenAI.APIUserAbortError) return failure(408, "CANCELLED", "请求已取消，可重新发送。");
    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) return failure(503, "API_KEY_INVALID", "OpenRouter 密钥无效或已失效，请检查服务端配置。");
      if (error.status === 402) return failure(402, "INSUFFICIENT_BALANCE", "OpenRouter 账户或密钥额度不足，请检查额度及免费模型使用限制。");
      if (error.status === 429) return failure(429, "RATE_LIMITED", "OpenRouter 免费模型请求受限或繁忙，请稍后重试。");
      if (error.status === 403) return failure(503, "ACCESS_DENIED", "当前 OpenRouter 账户无权使用此服务，请检查账户权限。");
      if (error.status === 404) return failure(503, "MODEL_UNAVAILABLE", "当前免费问答模型没有可用服务，请稍后重试。");
      if (error.status === 400 || error.status === 422) return failure(502, "PROVIDER_REQUEST_ERROR", "OpenRouter 未接受模型或请求参数，请检查服务端配置。");
      if (error.status === 503) return failure(503, "MODEL_UNAVAILABLE", "当前免费问答模型没有可用服务，请稍后重试。");
      return failure(502, "PROVIDER_UNAVAILABLE", "OpenRouter 服务暂时不可用，请稍后重试。");
    }
    return failure(500, "INTERNAL_ERROR", "聊天服务暂时出现异常，请稍后重试。");
  }
}
