import { randomInt } from "node:crypto";
import { SolarTermIdSchema } from "@/lib/contracts/cultural-case";
import { getSeasonGuide, GUIDE_TOPICS, isGuideMode, isGuideTopic, readLiveGuide } from "@/lib/season-guides";
import { SOLAR_TERMS } from "@/lib/solar-terms";
import { beginAiRequest } from "@/lib/server/ai-access";
import { AI_REQUEST_TIMEOUT_MS, classifyDeepSeekError, completeDeepSeek, createDeepSeekClient, DEEPSEEK_MODEL, logAiError } from "@/lib/server/deepseek";

export const maxDuration = 60;

function json(body: object, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const source = new URL(origin);
      if (!/^https?:$/u.test(source.protocol) || source.host !== (request.headers.get("host") ?? url.host)) {
        return json({ error: "请从四时风物册生成导读。" }, 403);
      }
    } catch {
      return json({ error: "请从四时风物册生成导读。" }, 403);
    }
  }

  const id = SolarTermIdSchema.safeParse(url.searchParams.get("term"));
  const mode = url.searchParams.get("mode");
  const previous = url.searchParams.get("previous");
  if (!id.success || !isGuideMode(mode)) return json({ error: "请先选择节气和导读讲法。" }, 400);
  if (previous !== null && !isGuideTopic(previous)) return json({ error: "请重新选择导读话题。" }, 400);

  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) return json({ error: "实时导读暂不可用，请先阅读本页导读。" }, 503);

  const access = beginAiRequest(request, "season-guide", JSON.stringify([id.data, mode, previous]));
  if ("status" in access) return json({ error: access.message }, access.status);

  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS)]);
  try {
    const term = SOLAR_TERMS.find(({ id: termId }) => termId === id.data)!;
    const preview = getSeasonGuide(id.data);
    const choices = Object.keys(GUIDE_TOPICS).filter(isGuideTopic).filter(topic => topic !== previous);
    const baseGuide = preview[mode].intro;
    const existingSentences = baseGuide.flatMap(paragraph => paragraph.split(/[。！？]/u)).filter(sentence => sentence.length >= 12);
    const client = createDeepSeekClient(apiKey);
    for (let attempt = 0; attempt < 2; attempt++) {
      const [topic] = choices.splice(randomInt(choices.length), 1);
      const completion = await completeDeepSeek(client, {
        model: DEEPSEEK_MODEL,
        thinking: { type: "disabled" },
        stream: false,
        max_tokens: 480,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "你是四时风物册的导读员。按照 topic 自选一个与当前节气相关的基础知识点，或给出一个具体的观察方法。baseGuide 是读者已经读过的内容，连开场和结尾也不要重复其中的事实、故事或例子。直接从新知识点讲起。有 previousTopic 时，选一个与它的范围也不同的知识点。优先讲常识和可观察的现象。避免具体年份的日期、实时天气、无依据的地点、传闻和数字。解释时保留地区、半球或天气等必要条件。观察活动要安全，不建议直视太阳。中文约80至150字，写一段，不加标题、网址、引用编号或 Markdown。只返回 JSON 对象，格式为 {\"guide\":\"一段导读\"}。",
          },
          {
            role: "user",
            content: JSON.stringify({
              term: term.name, baseGuide, topic: GUIDE_TOPICS[topic],
              previousTopic: previous ? GUIDE_TOPICS[previous] : undefined,
              style: mode === "children" ? "像坐在小朋友身边聊天。用短句和孩子熟悉的事物解释难词，可以邀请孩子想一想。" : "用通俗准确的语言解释一个具体细节。",
            }),
          },
        ],
      }, signal);
      const choice = completion.choices[0];
      let guide = null;
      if (choice?.finish_reason === "stop" && choice.message.content) {
        try { guide = readLiveGuide(JSON.parse(choice.message.content)); } catch { /* Invalid provider JSON. */ }
      }
      if (guide && !preview.repeatedTopic.test(guide) && !existingSentences.some(sentence => guide.includes(sentence))) {
        return json({ guide, topic });
      }
    }
    logAiError("season-guide", "INVALID_RESPONSE", 502);
    return json({ error: "这次没有生成可用的导读，请重试。" }, 502);
  } catch (error) {
    const issue = classifyDeepSeekError(error, signal);
    logAiError("season-guide", issue.code, issue.status);
    return json({ error: issue.message }, issue.status);
  } finally {
    access.finish();
  }
}
