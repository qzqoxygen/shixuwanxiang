// Shared limits only. Credentials and the system prompt stay in the server route.
export const MAX_INPUT_LENGTH = 1000;
export const MAX_ASSISTANT_LENGTH = 8000;
export const MAX_HISTORY_MESSAGES = 10;
export const MAX_REQUEST_MESSAGES = MAX_HISTORY_MESSAGES + 1;
export const MAX_BODY_BYTES = 200_000;

export type ChatMessage = { role: "user" | "assistant"; content: string };

export function validateMessages(body: unknown): ChatMessage[] {
  if (!body || typeof body !== "object" || !("messages" in body) || !Array.isArray(body.messages)) {
    throw new Error("请求必须包含 messages 消息数组。");
  }
  const messages: unknown[] = body.messages;
  if (messages.length < 1 || messages.length > MAX_REQUEST_MESSAGES || messages.length % 2 === 0) {
    throw new Error("请携带最多 5 轮完整历史对话，并以新的用户问题结尾。");
  }
  return messages.map((message, index) => {
    const role = index % 2 === 0 ? "user" : "assistant";
    if (!message || typeof message !== "object" || !("role" in message) || message.role !== role || !("content" in message) || typeof message.content !== "string") {
      throw new Error("消息须按用户、助手交替排列，仅支持纯文本。");
    }
    const limit = role === "user" ? MAX_INPUT_LENGTH : MAX_ASSISTANT_LENGTH;
    if (!message.content.trim() || message.content.length > limit) {
      throw new Error(role === "user" ? `问题不能为空，且不能超过 ${MAX_INPUT_LENGTH} 字符。` : "历史回复为空或过长，请清空对话后重试。");
    }
    // Rebuild messages so callers cannot inject system roles or SDK parameters.
    return { role, content: message.content.trim() };
  });
}
