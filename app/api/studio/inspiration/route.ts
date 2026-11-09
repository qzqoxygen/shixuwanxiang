import OpenAI from "openai";
import type { CompletionParams } from "@/lib/ai-agent";
import { SOLAR_TERMS } from "@/lib/solar-terms";
import { isStudioFormat, readStudioSuggestions, STUDIO_FORMATS, STUDIO_LINE_LIMIT, STUDIO_TITLE_LIMIT } from "@/lib/studio-inspiration";

const headers = { "Cache-Control": "no-store" };

function failure(status: number, error: string) {
  return Response.json({ error }, { status, headers });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin !== null) {
    try {
      const source = new URL(origin);
      const host = request.headers.get("host") ?? url.host;
      if (!/^https?:$/.test(source.protocol) || source.host !== host) return failure(403, "请从造物工坊生成灵感。");
    } catch {
      return failure(403, "请从造物工坊生成灵感。");
    }
  }

  // The request carries only two catalog IDs, with no draft text or body.
  const term = SOLAR_TERMS.find(({ id }) => id === url.searchParams.get("term"));
  const format = url.searchParams.get("format");
  if (!term || !isStudioFormat(format)) return failure(400, "请先选择有效的节气和版式。");

  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) return failure(503, "AI 灵感暂未开启，你可以继续手动编辑。");

  const params: CompletionParams = {
    model: "deepseek-flash",
    thinking: { type: "disabled" },
    stream: false,
    max_tokens: 650,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `你为二十四节气主题的中文卡片写原创标题和短句。用清楚、自然的中文，以具体风物或生活细节表现节气，避免套话，不编造出处，不把传统物候说成各地必然发生的天气。给出三组构思，各组选不同意象。标题最多 ${STUDIO_TITLE_LIMIT} 字，短句最多 ${STUDIO_LINE_LIMIT} 字，不换行，不加编号或 Markdown。书签上的文字宜更短。只返回 JSON，格式示例：{"suggestions":[{"title":"雨过青阶","line":"檐声渐歇，石阶留住一片新绿。"}]}。`,
      },
      { role: "user", content: `节气：${term.name}。版式：${STUDIO_FORMATS[format]}。${term.description}` },
    ],
  };

  try {
    const client = new OpenAI({ baseURL: "https://api.deepseek.com", apiKey, timeout: 20_000, maxRetries: 0, logLevel: "off" });
    const completion = await client.chat.completions.create(params, { signal: request.signal });
    const choice = completion.choices[0];
    if (choice?.finish_reason === "stop" && choice.message.content?.trim()) {
      const suggestions = readStudioSuggestions(JSON.parse(choice.message.content));
      if (suggestions.length) return Response.json({ suggestions }, { headers });
    }
  } catch (error) {
    if (error instanceof OpenAI.APIConnectionTimeoutError) return failure(504, "这次等待超时了，请重试。");
    if (error instanceof OpenAI.APIConnectionError) return failure(502, "暂时连不上 DeepSeek，请检查网络后重试。你可以继续编辑作品。");
    if (error instanceof OpenAI.APIError && error.status === 429) return failure(429, "请求有点频繁，请稍后重试。");
    if (error instanceof OpenAI.APIError && [401, 402, 403].includes(error.status ?? 0)) {
      return failure(503, "AI 灵感暂不可用，你可以继续手动编辑。");
    }
  }
  return failure(502, "这次没能生成灵感，请重试。");
}
