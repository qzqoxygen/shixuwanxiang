import "server-only";
import { ChatRequestV1Schema, EMPTY_CHAT_CONTEXT, type ChatContext } from "../contracts/chat-api";
import { validateMessages } from "../chat";
import { readCulturalCases } from "./cultural-cases";
import { findVerifiedCulturalCase } from "./cultural-case-query";

export class ChatProtocolError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export function parseChatRequest(body: unknown) {
  const versioned = !!body && typeof body === "object" && Object.hasOwn(body, "version");
  let context: ChatContext = EMPTY_CHAT_CONTEXT;
  if (versioned) {
    if ((body as { version: unknown }).version !== "1.0") throw new ChatProtocolError("UNSUPPORTED_VERSION", "聊天协议版本不受支持，请刷新页面。");
    const parsed = ChatRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      const invalidContext = parsed.error.issues.some(issue => issue.path[0] === "context" && issue.code !== "unrecognized_keys");
      throw new ChatProtocolError(invalidContext ? "INVALID_CONTEXT" : "INVALID_INPUT", invalidContext ? "地图上下文无效，请重新选择后发送。" : "聊天参数不符合约定，请刷新页面后重试。");
    }
    context = parsed.data.context;
    if (context.caseId) {
      const item = findVerifiedCulturalCase(readCulturalCases(), context.caseId);
      if (!context.solarTermId || !context.provinceCode || !item || !item.solarTermIds.includes(context.solarTermId) ||
        (item.provinceCode !== context.provinceCode && !item.relatedProvinceCodes?.includes(context.provinceCode))) {
        throw new ChatProtocolError("INVALID_CONTEXT", "当前案例与节气或地区不匹配，请重新选择。");
      }
    }
  }
  return { versioned, context, messages: validateMessages(body) };
}
