import { isIP } from "node:net";
import { z } from "zod";
import type { ChatMessage } from "../chat";

export type WebSource = { title: string; url: string; content: string; snippet?: string };
export type SearchContext = { query: string; retrievedAt: string; sources: WebSource[] };

export class SearchError extends Error {
  constructor(public code: string, message: string, public status?: number) { super(message); }
}

const timeSensitive = /最新|实时|即時|近期|最近|目前|现在|当前|今天|今日|今年|本年度|明天|明日|后天|後天|明年|昨天|昨日|去年|本周|下周|本月|下月|下一个节气|下個節氣|这个月|这周|这次|这届|这几天|搜索|检索|查一下|查一查|帮我查|联网|聯網|上网|新闻|资讯|天气|气温|预报|门票|票价|开放时间|营业|预约|举办|举行|活动|庆典|展览|演出|流星雨|日食|月食|日出|日落|几[点时分月号]|什么时间|具体时间|日期|时刻|交节|何时|什么时候|哪天|哪一天|\d{1,2}月\d{1,2}日|\b(?:19|20)\d{2}\b|\btoday\b|\blatest\b|\bcurrent\b|\bweather\b|\bnews\b|\bsearch\b/iu;
const followUp = /^(那|那么|那里|这[个些]|它|他们|有没有|还有|要不要|需要|在哪|怎么去|多少钱|几点|何时|具体|详细|继续|来源|链接|what about|and |where|when)/iu;

export function needsWebSearch(history: ChatMessage[]): boolean {
  const questions = history.filter((message) => message.role === "user").toReversed();
  for (const { content } of questions) {
    if (timeSensitive.test(content)) return true;
    if (!followUp.test(content) || /为什么|为何|是什么|区别|原理|由来|起源|习俗/u.test(content)) return false;
  }
  return false;
}

export function buildSearchQuery(history: ChatMessage[], now = new Date()): string {
  const questions = history.filter((message) => message.role === "user");
  let start = questions.length - 1;
  while (start > 0 && followUp.test(questions[start].content)) start--;
  const date = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
  // The Search API accepts 128 Unicode characters; reserve space for the newest question first.
  const topics = questions.slice(start).reverse().map((message) => message.content);
  const namedSites = [
    [/香港天文[台臺]/u, "hko.gov.hk"],
    [/中国气象局|中國氣象局/u, "cma.gov.cn"],
  ] as const;
  const sites = namedSites.filter(([name]) => topics.some((topic) => name.test(topic)));
  const site = sites.length === 1 ? "site:" + sites[0][1] : "";
  const query = [site, date, ...topics].filter(Boolean).join(" ");
  return [...query].slice(0, 128).join("").trimEnd();
}

function publicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/\.$/u, "");
    return !/\s/u.test(value) && ["http:", "https:"].includes(url.protocol) && !url.username && !url.password &&
      host.includes(".") && !host.endsWith(".local") && !host.endsWith(".localhost") &&
      host !== "localhost" && !isIP(host) && !host.includes(":");
  } catch { return false; }
}

const resultSchema = z.object({
  title: z.string().trim().min(1),
  url: z.string().max(2048).refine(publicUrl),
  summary: z.string().trim().optional(),
  snippet: z.string().trim().optional(),
});

function isAuthoritativeWebSource(source: WebSource): boolean {
  const host = new URL(source.url).hostname;
  return /\.(gov\.cn|gov\.hk|edu\.cn|ac\.cn)$/u.test(host) ||
    ["ihchina.cn", "news.cn", "xinhuanet.com", "cctv.com", "people.com.cn"].some((domain) => host === domain || host.endsWith("." + domain));
}

export function isVisitWebSource(source: WebSource): boolean {
  const host = new URL(source.url).hostname;
  return isAuthoritativeWebSource(source) ||
    ["cnr.cn", "cnnb.com.cn", "sxdaily.com.cn", "ylrb.com", "dailyqd.com", "qtv.com.cn", "chinanews.com.cn"].some(domain => host === domain || host.endsWith("." + domain));
}

export async function searchWeb(query: string, signal: AbortSignal, accept?: (source: WebSource) => boolean): Promise<WebSource[]> {
  signal.throwIfAborted();
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new SearchError("SEARCH_KEY_MISSING", "尚未配置联网检索服务。");
  const timeout = AbortSignal.timeout(8_000);
  try {
    const response = await fetch("https://api.deepseek.com/v1/tools/search", {
      method: "POST", cache: "no-store", redirect: "error",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query, count: 8, need_content: false }),
      signal: AbortSignal.any([signal, timeout]),
    });
    if (!response.ok) {
      const codes: Record<number, string> = {
        401: "SEARCH_AUTH_FAILED", 402: "SEARCH_INSUFFICIENT_BALANCE", 403: "SEARCH_AUTH_FAILED",
        408: "SEARCH_TIMEOUT", 429: "SEARCH_RATE_LIMITED", 504: "SEARCH_TIMEOUT",
      };
      throw new SearchError(codes[response.status] ?? "SEARCH_FAILED", "联网搜索失败，本次无法核实实时信息。", response.status);
    }
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("results" in data) || !Array.isArray(data.results)) {
      throw new SearchError("SEARCH_INVALID_RESPONSE", "联网搜索返回的资料格式无效。");
    }
    const sources: WebSource[] = [];
    const requestedSite = /^site:([a-z0-9.-]+)\s/i.exec(query)?.[1];
    for (const raw of data.results) {
      const parsed = resultSchema.safeParse(raw);
      if (!parsed.success || sources.some((source) => source.url === parsed.data.url)) continue;
      const host = new URL(parsed.data.url).hostname;
      if (requestedSite && host !== requestedSite && !host.endsWith("." + requestedSite)) continue;
      const content = parsed.data.summary || parsed.data.snippet;
      if (!content) continue;
      const source = { title: parsed.data.title.slice(0, 200), url: parsed.data.url, content: content.slice(0, 1600) };
      const evidence = accept && parsed.data.snippet ? { ...source, snippet: parsed.data.snippet.slice(0, 500) } : source;
      if (!accept || accept(evidence)) sources.push(evidence);
    }
    const selected = sources.sort((a, b) => Number(isAuthoritativeWebSource(b)) - Number(isAuthoritativeWebSource(a))).slice(0, 5);
    if (!selected.length) throw new SearchError("SEARCH_EMPTY", "未检索到可核实的资料，本次无法确认实时信息，请补充地点、年份或活动名称。");
    return selected;
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    if (error instanceof SearchError) throw error;
    if (timeout.aborted) throw new SearchError("SEARCH_TIMEOUT", "联网搜索超时，本次无法核实实时信息。");
    if (error instanceof SyntaxError) throw new SearchError("SEARCH_INVALID_RESPONSE", "联网搜索返回的资料格式无效。");
    throw new SearchError("SEARCH_FAILED", "联网搜索失败，本次无法核实实时信息，请稍后重试。");
  }
}

export function attachSearchSources(answer: string, context: SearchContext): string {
  const citations = [...answer.matchAll(/\[(\d+)\]/gu)].map((match) => Number(match[1]));
  if (!citations.length || citations.some((id) => id < 1 || id > context.sources.length) || /https?:\/\//iu.test(answer)) {
    throw new SearchError("SEARCH_ANSWER_UNSUPPORTED", "已完成联网搜索，但回答未能对应检索来源，请重新提问后核实。");
  }
  const links = [...new Set(citations)].map((id) => {
    const source = context.sources[id - 1];
    const title = /https?:\/\//iu.test(source.title) ? new URL(source.url).hostname : source.title.replace(/[\r\n]/gu, " ");
    return `[${id}] ${title}\n${source.url}`;
  });
  return `${answer}\n\n参考来源（检索于 ${context.retrievedAt}）\n${links.join("\n")}`;
}
