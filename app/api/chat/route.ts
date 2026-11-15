import { AI_REQUEST_TIMEOUT_MS, createDeepSeekClient, completeDeepSeek, classifyDeepSeekError, logAiError } from "@/lib/server/deepseek";
import { beginAiRequest } from "@/lib/server/ai-access";
import { MAX_ASSISTANT_LENGTH, MAX_BODY_BYTES } from "@/lib/chat";
import { AgentError, runChatAgent, validateAgentAnswer } from "@/lib/ai-agent";
import { type SearchContext, SearchError, needsWebSearch, buildSearchQuery, searchWeb, attachSearchSources } from "@/lib/server/web-search";
import { CulturalContextError, culturalAnswerSources } from "@/lib/server/cultural-case-context";
import { createChatCaseTool, createCultureAgentTools } from "@/lib/server/chat-case-tool";
import { ChatSuccessV1Schema, type CulturalMapState } from "@/lib/contracts/chat-api";
import { ChatProtocolError, parseChatRequest } from "@/lib/server/chat-protocol";
import { applyValidatedMapActions } from "@/lib/map-actions";
import { readCulturalCases } from "@/lib/server/cultural-cases";
import { EvidenceError, validateAnswerEvidence, buildAnswerEvidence } from "@/lib/server/answer-evidence";

// Cache Components uses the default Node.js runtime. Leave time to return a JSON error.
export const maxDuration = 60;

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
    return Response.json({ version: "1.0", answer: null, truncated: false, error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
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
  let parsed;
  try {
    parsed = parseChatRequest(body);
  }
  catch (error) { return failure(400, error instanceof ChatProtocolError ? error.code : "INVALID_INPUT", error instanceof Error ? error.message : "消息格式无效。"); }
  const { messages, context, versioned, includeEvidence } = parsed;

  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    logAiError("chat", "API_KEY_MISSING", 503);
    return failure(503, "API_KEY_MISSING", "问答服务尚未配置 DeepSeek 密钥，请联系管理员。");
  }
  const access = beginAiRequest(request, "chat", JSON.stringify([messages, versioned ? context : null]));
  if ("status" in access) return failure(access.status, access.code, access.message);

  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS)]);
  try {
    let search: SearchContext | null | undefined;
    if (needsWebSearch(messages)) {
      const query = buildSearchQuery(messages);
      try {
        const sources = await searchWeb(query, signal);
        search = { query, sources, retrievedAt: new Date().toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" }) + "（北京时间）" };
      } catch (error) {
        signal.throwIfAborted();
        if (!(error instanceof SearchError)) throw error;
        logAiError("search", error.code, error.status ?? 503);
        search = null;
      }
    }
    const client = createDeepSeekClient(apiKey);
    const agent = versioned ? createCultureAgentTools(messages, context) : undefined;
    const legacyLookup = agent ? undefined : createChatCaseTool(messages);
    const lookup = agent ?? legacyLookup!;
    const complete = (params: Parameters<typeof completeDeepSeek>[1]) => completeDeepSeek(client, params, signal);
    let result = await runChatAgent(complete, messages, agent?.tools ?? [legacyLookup!.tool], search, [], { context: versioned ? context : undefined, signal, reuseReadTools: includeEvidence, deferFinalValidation: true });
    const toolEvents = result.toolEvents;
    const terms = [...lookup.terms];
    const cases = lookup.searched || versioned ? lookup.cases : lookup.fallback.cases;
    function finalize(answer: string, records: typeof cases) {
      validateAgentAnswer(answer, search, Boolean(agent), Boolean(agent?.mapActions.length && !toolEvents.some(event => event.status === "error")));
      validateAnswerEvidence(answer, records, search);
      const sources = culturalAnswerSources(answer, records, terms);
      if (search === undefined && cases.length && !sources.references.length) {
        throw new CulturalContextError("本轮回答缺少对应的文化案例引用。");
      }
      return { ...sources, answerText: search ? attachSearchSources(answer, search) : answer };
    }
    let sources;
    try {
      sources = finalize(result.answer, lookup.cases);
    } catch (error) {
      const repairable = error instanceof CulturalContextError || error instanceof EvidenceError ||
        (error instanceof AgentError && ["UNVERIFIED_ANSWER", "UNAPPLIED_MAP_CLAIM"].includes(error.code)) ||
        (error instanceof SearchError && error.code === "SEARCH_ANSWER_UNSUPPORTED");
      if (!repairable || signal.aborted) throw error;
      // All final-answer guards share this one repair budget; original tools are never replayed.
      const mapInstruction = agent ? !agent.mapActions.length || toolEvents.some(event => event.status === "error")
        ? "本轮未生成可用地图操作，没有地图操作入口。只解释本轮案例，不得声称准备好了地图操作、上一轮已设置地图或已打开详情。"
        : "地图仅准备好待用户点击「在地图中查看」的操作。不得写已高亮、已切换地图或案例已打开。" : "";
      result = await runChatAgent(complete, messages, [], search, cases, { context: versioned ? context : undefined, signal, deferFinalValidation: true,
        repairInstruction: "修正最终回答：只能引用本轮材料，不得复制历史编号或输出网址。本轮无联网资料时不能使用[1]等数字引用；本地资料使用[案例1]形式。" + mapInstruction });
      sources = finalize(result.answer, cases);
      if (cases.length && !sources.references.length) throw new CulturalContextError("回答仍未对应已核验的案例来源，请重新提问。");
    }
    const { notes, references } = sources;
    let answerText = sources.answerText;
    if (search === null) answerText = "本次未能核实实时信息。以下仅供了解相关背景。\n\n" + answerText;
    const answer = answerText + notes;
    if (answer.length > MAX_ASSISTANT_LENGTH) throw new AgentError("INVALID_RESPONSE", "回答及来源过长，请简化问题后重试。");
    const legacy = {
      answer, truncated: result.truncated,
      ...(references.length ? { answerText, caseReferences: references } : {}),
      ...(lookup.searched ? { caseLookup: { matchedTitles: lookup.cases.map(({ title }) => title) } } : {}),
      ...((lookup.searched ? lookup.cases.length === 0 : lookup.fallback.noMatch) ? { noLocalCaseMatch: true } : {}),
    };
    if (!agent) return Response.json(legacy, { headers: { "Cache-Control": "no-store" } });
    const mapActions = toolEvents.some(event => event.status === "error") ? [] : agent.mapActions;
    const state: CulturalMapState = { selectedSolarTermId: context.solarTermId, selectedProvinceCode: context.provinceCode, selectedCaseId: context.caseId, highlightedProvinceCodes: [] };
    try { applyValidatedMapActions(state, mapActions, readCulturalCases()); }
    catch { return failure(502, "INVALID_MAP_ACTIONS", "地图操作与已核验资料不匹配，本轮未更新地图。"); }
    const retrievedReferences = agent.cases.flatMap(item => item.sources.map(source => ({ ...source, caseId: item.id, caseTitle: item.title })))
      .filter((source, index, all) => all.findIndex(other => other.caseId === source.caseId && other.url === source.url) === index).slice(0, 20);
    const response = ChatSuccessV1Schema.parse({ ...legacy, version: "1.0", reply: answer, mapActions, toolEvents, references: retrievedReferences,
      ...(includeEvidence ? { evidence: buildAnswerEvidence(result.answer, agent.cases, search), retrievalDiagnostics: agent.retrievalDiagnostics } : {}),
    });
    return Response.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const issue = error instanceof AgentError || error instanceof SearchError || error instanceof CulturalContextError || error instanceof EvidenceError
      ? { status: 502, code: error.code, message: error.message }
      : classifyDeepSeekError(error, signal);
    logAiError("chat", issue.code, issue.status);
    return failure(issue.status, issue.code, issue.message);
  } finally {
    access.finish();
  }
}
