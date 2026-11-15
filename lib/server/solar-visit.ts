import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { z } from "zod";
import { type CompletionParams } from "../ai-agent";
import { SUPPORTED_PROVINCES } from "../provinces";
import { SOLAR_TERMS } from "../solar-terms";
import type { VisitQuery, VisitWebSeed } from "../solar-visit";
import { beginAiRequest } from "./ai-access";
import { AI_REQUEST_TIMEOUT_MS, completeDeepSeek, createDeepSeekClient, DEEPSEEK_MODEL } from "./deepseek";
import { isVisitWebSource, type WebSource } from "./web-search";

const regionalPublishers = [
  ["330000", /(^|\.)cnnb\.com\.cn$|^zj\.cnr\.cn$/u],
  ["370000", /(^|\.)(dailyqd|qtv)\.com\.cn$/u],
  ["610000", /(^|\.)(sxdaily\.com\.cn|ylrb\.com)$/u],
] as const;

export function visitJson(body: object, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function readVisitInput<T>(request: Request, schema: z.ZodType<T>, originError = "请从节气探访页面发起请求。") {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? new URL(request.url).host;
  if (origin !== null && origin !== `https://${host}` && origin !== `http://${host}`) {
    return { response: visitJson({ error: originError }, 403) } as const;
  }
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return { response: visitJson({ error: "请求格式必须为 JSON。" }, 415) } as const;
  }
  const reader = request.body?.getReader();
  if (reader) {
    try {
      const decoder = new TextDecoder("utf-8", { fatal: true });
      let bytes = 0;
      let json = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 4096) {
          await reader.cancel();
          return { response: visitJson({ error: "请求内容太长。" }, 413) } as const;
        }
        json += decoder.decode(value, { stream: true });
      }
      const parsed = schema.safeParse(JSON.parse(json + decoder.decode()));
      if (parsed.success) return { data: parsed.data } as const;
    } catch {
      // Invalid UTF-8 and malformed JSON share the same form error.
    } finally {
      reader.releaseLock();
    }
  }
  return { response: visitJson({ error: "请检查所填内容后再试。" }, 400) } as const;
}

export function startVisitAi(request: Request, route: "visit" | "visit-memory", input: object) {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) return { response: visitJson({ error: "AI 服务暂不可用，请稍后再试。" }, 503) } as const;
  const access = beginAiRequest(request, route, JSON.stringify(input));
  if ("status" in access) return { response: visitJson({ error: access.message }, access.status) } as const;
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS)]);
  return { complete: (params: CompletionParams) => completeDeepSeek(createDeepSeekClient(apiKey), params, signal), signal, finish: access.finish } as const;
}

export function visitPlace(query: VisitQuery) {
  const province = SUPPORTED_PROVINCES.find(({ code }) => code === query.provinceCode)!.name;
  const term = SOLAR_TERMS.find(({ id }) => id === query.solarTermId)!.name;
  return { province, term, area: query.area.replace(/(?:市|县|区|旗|镇|乡|村)$/u, "") || query.area };
}

export function visitSearchQuery(query: VisitQuery) {
  const { province, term } = visitPlace(query);
  return [province, query.area, term, "习俗"].filter(Boolean).join(" ");
}

export function visitWebEvidence(query: VisitQuery, sources: WebSource[], candidate: { source: number; quote: string; relation: "direct" | "lead" }) {
  const source = sources[candidate.source - 1];
  if (!source || !isVisitWebSource(source)) return;
  const { province, area, term } = visitPlace(query);
  const provinceName = province.replace(/(?:壮族|回族|维吾尔)?自治区|特别行政区|[省市]$/u, "");
  const quote = candidate.quote.trim();
  const cultural = /习俗|风俗|民俗|习惯|传统|祭|食|吃|酿|采|农事|饮|舞|制|种|晒|收割/u;
  // The model can select an excerpt. Only the provider's actual text and link are displayed.
  if (!(source.content.includes(quote) || source.snippet?.includes(quote)) || !cultural.test(quote) || /[\r\n]|https?:\/\//iu.test(quote)) return;
  const host = new URL(source.url).hostname;
  const regionalPublisher = regionalPublishers.some(([code, pattern]) => code === query.provinceCode && pattern.test(host));
  if (!(source.title + quote + source.content).includes(provinceName) && !regionalPublisher) return;
  if (area && !(source.title + quote).includes(area)) return;
  const direct = candidate.relation === "direct" && quote.includes(term) &&
    quote.split(/[。！？；]/u).some(sentence => sentence.includes(term) && cultural.test(sentence)
      && (sentence.includes(area || provinceName) || (!area && regionalPublisher)));
  return { kind: direct ? "web" as const : "lead" as const, evidence: { title: source.title, url: source.url, quote } };
}

export function webEvidenceProof(key: string, query: VisitQuery, evidence: Omit<VisitWebSeed["evidence"], "proof">) {
  return createHmac("sha256", key)
    .update(JSON.stringify(["solar-visit-web-v1", query.provinceCode, query.solarTermId, query.area, evidence.title, evidence.url, evidence.quote]))
    .digest("hex");
}

export function verifyWebEvidence(key: string, { query, evidence }: VisitWebSeed) {
  const expected = webEvidenceProof(key, query, evidence);
  return timingSafeEqual(Buffer.from(evidence.proof, "hex"), Buffer.from(expected, "hex"));
}

export const visitCompletion = { model: DEEPSEEK_MODEL, thinking: { type: "disabled" }, stream: false, max_tokens: 550 } as const;
