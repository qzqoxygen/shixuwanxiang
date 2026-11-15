import "server-only";
import type { ChatMessage } from "../chat";
import { CulturalCaseIdSchema, MAX_CHAT_CASE_REFERENCES, type ChatCaseReference, type CulturalCase, type VerifiedCulturalCase } from "../contracts/cultural-case";
import { SUPPORTED_PROVINCES } from "../provinces";
import { SOLAR_TERMS, type SolarTermId } from "../solar-terms";
import { findVerifiedCulturalCase, queryCulturalCases } from "./cultural-case-query";
import { readCulturalCases } from "./cultural-cases";

const followUp = /^(那|那么|这[个些两]|它|当地|那里|还有|具体|详细|继续|来源|链接|再|换成|比较|对比|分别)/u;
const cultureQuestion = /习俗|民俗|风俗|传统|文化|案例|故事|非遗|技艺|农事|手艺|祭|吃|喝|酿|织|制作|活动|意象|文创|创意|饮食/u;
const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });
const genericWords = new Set(["介绍", "讲讲", "请问", "关于", "什么", "哪些", "如何", "怎么", "这个", "这些", "那里", "当地", "还有", "具体", "详细", "继续", "来源", "链接", "文化", "案例", "地方", "传统", "习俗", "民俗", "节气", "相关", "知识", "饮食", "地区", "一带"]);

function words(text: string): string[] {
  const tokens: string[] = [];
  let characters = "";
  for (const { segment, isWordLike } of segmenter.segment(text)) {
    if (isWordLike && segment.length === 1) { characters += segment; continue; }
    if (characters) { tokens.push(characters); characters = ""; }
    if (isWordLike) tokens.push(segment);
  }
  if (characters) tokens.push(characters);
  return tokens.map((word) => word.replace(/(?:省|市|县|区)$/u, "")).filter((word) => word.length >= 2 && !genericWords.has(word));
}

function dimensions(text: string) {
  return {
    terms: SOLAR_TERMS.filter(({ name }) => text.includes(name)).map(({ id }) => id),
    provinces: SUPPORTED_PROVINCES.filter(({ name }) => text.includes(name.replace(/(?:壮族|回族|维吾尔)?自治区|特别行政区|省|市/gu, ""))).map(({ code }) => code),
  };
}

function categoryFor(text: string) {
  if (/饮食|美食|小吃|食物/u.test(text)) return "food";
  if (/农事|农耕|耕作|播种/u.test(text)) return "agriculture";
  if (/技艺|手工|工艺/u.test(text)) return "craft";
  if (/民俗类|礼俗类|祭祀类|祭祖类/u.test(text)) return "folk_custom";
  return undefined;
}

// Match the current topic, inheriting missing filters only for explicit follow-ups.
// The assistant's previous answer never becomes a source or a retrieval query.
export function retrieveChatCases(history: readonly ChatMessage[], cases: readonly CulturalCase[] = readCulturalCases(), limit = MAX_CHAT_CASE_REFERENCES) {
  const questions = history.filter(({ role }) => role === "user");
  const latest = questions.at(-1)?.content ?? "";
  const normalize = (value: string) => value.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
  const exact = cases.filter((item): item is VerifiedCulturalCase => item.verificationStatus === "verified" && normalize(latest).includes(normalize(item.title)));
  let start = questions.length - 1;
  while (start > 0 && followUp.test(questions[start].content)) start--;
  const topics = questions.slice(start).map(({ content }) => content).reverse();
  const current = dimensions(latest);
  const terms = current.terms.length ? current.terms : topics.map((topic) => dimensions(topic).terms).find((ids) => ids.length) ?? [];
  if (exact.length) return { cases: exact.slice(0, limit), terms, noMatch: false };
  const filters = new Set(topics.flatMap((topic) => {
    const found = dimensions(topic);
    return [...found.terms.flatMap((id) => words(SOLAR_TERMS.find((term) => term.id === id)!.name)),
      ...found.provinces.flatMap((code) => words(SUPPORTED_PROVINCES.find((province) => province.code === code)!.name))];
  }));
  const keywords = [...new Set(topics.flatMap(words))].filter((word) => !filters.has(word));
  const currentRegions = words(latest).filter((word) => !filters.has(word) && cases.some((item) => item.regionName.includes(word)));
  // A named city in a follow-up replaces the previous province, rather than intersecting it.
  const provinces = current.provinces.length ? current.provinces : currentRegions.length ? []
    : topics.map((topic) => dimensions(topic).provinces).find((codes) => codes.length) ?? [];
  const category = topics.map(categoryFor).find(Boolean);
  const ranked = cases
    .filter((item) => item.verificationStatus === "verified" && (!category || item.category === category) && (!terms.length || item.solarTermIds.some((id) => terms.includes(id))) &&
      (!provinces.length || provinces.some((code) => item.provinceCode === code || item.relatedProvinceCodes?.includes(code))) &&
      (!currentRegions.length || currentRegions.some((region) => item.regionName.includes(region))))
    .map((item) => ({ item, score: keywords.reduce((score, word) => score + (item.title.includes(word) ? 4 : item.regionName.includes(word) ? 3 : item.description.includes(word) || item.relationNote.includes(word) ? 1 : 0), 0) }));
  const hasKeywords = ranked.some(({ score }) => score > 0);
  // A bare term or an astronomy/climate question does not need unrelated custom examples.
  const hasCultureTopic = topics.some((topic) => cultureQuestion.test(topic)) ||
    (provinces.length > 1 && /比较|对比|不同|区别/u.test(latest));
  if (!hasCultureTopic && (!hasKeywords || /黄经|黄道|公转|自转|直射|昼夜|白昼|气温|天气|温度|气候|最冷|最热/u.test(latest))) {
    return { cases: [], terms, noMatch: false };
  }
  const ordered = ranked.filter(({ score }) => hasKeywords ? score > 0 : terms.length || provinces.length)
    .filter((entry): entry is { item: VerifiedCulturalCase; score: number } => entry.item.verificationStatus === "verified")
    .sort((a, b) => b.score - a.score || (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0));
  // Reserve a place for each requested region before filling remaining relevant results.
  const reserved = new Set<string>();
  for (const code of provinces) {
    const candidate = ordered.find(({ item }) => item.provinceCode === code || item.relatedProvinceCodes?.includes(code));
    if (candidate && reserved.size < limit) reserved.add(candidate.item.id);
  }
  for (const { item } of ordered) if (reserved.size < limit) reserved.add(item.id);
  const matched = ordered.filter(({ item }) => reserved.has(item.id)).map(({ item }) => item);
  return { cases: matched, terms, noMatch: matched.length === 0 && hasCultureTopic && Boolean(terms.length || provinces.length || currentRegions.length) };
}

export function studioCulturalCases(solarTermId: SolarTermId, cases: readonly CulturalCase[] = readCulturalCases()): VerifiedCulturalCase[] {
  return queryCulturalCases(cases, { solarTermId, offset: 0, limit: 20 }).items;
}

export function studioCaseForTerm(caseId: unknown, solarTermId: SolarTermId) {
  const parsed = CulturalCaseIdSchema.safeParse(caseId);
  if (!parsed.success) return undefined;
  const item = findVerifiedCulturalCase(readCulturalCases(), parsed.data);
  return item?.solarTermIds.includes(solarTermId) ? item : undefined;
}

export function culturalCaseContext(cases: readonly VerifiedCulturalCase[]) {
  return cases.map((item, index) => ({
    citation: `案例${index + 1}`, caseId: item.id, title: item.title,
    solarTerms: item.solarTermIds.map((id) => SOLAR_TERMS.find((term) => term.id === id)!.name),
    province: item.provinceName, region: item.regionName,
    relatedProvinces: item.relatedProvinceCodes?.map((code) => SUPPORTED_PROVINCES.find((province) => province.code === code)!.name),
    description: item.description, relationNote: item.relationNote, sources: item.sources,
  }));
}

export class CulturalContextError extends Error {
  code = "CASE_ANSWER_UNSUPPORTED";
}

// Keep archived-case citations separate from numbered, freshly retrieved web sources.
export function culturalAnswerSources(answer: string, cases: readonly VerifiedCulturalCase[], terms: readonly SolarTermId[] = []) {
  const labels = answer.match(/\[案例[^\]\r\n]*\]?/gu) ?? [];
  if (labels.some((label) => !/^\[案例[1-9]\d*\]$/u.test(label))) {
    throw new CulturalContextError("回答未能对应已核验的文化案例，请重新提问后核实。");
  }
  const citations = [...answer.matchAll(/\[案例(\d+)\]/gu)].map((match) => Number(match[1]));
  if (!citations.length) return { notes: "", references: [] };
  if (citations.some((id) => id < 1 || id > cases.length) || /https?:\/\//iu.test(answer)) {
    throw new CulturalContextError("回答未能对应已核验的文化案例，请重新提问后核实。");
  }
  const references: ChatCaseReference[] = [...new Set(citations)].map((citation) => {
    const item = cases[citation - 1];
    return {
      citation, caseId: item.id, title: item.title, provinceCode: item.provinceCode,
      provinceName: item.provinceName, regionName: item.regionName, sources: item.sources,
      solarTermId: terms.find((term) => item.solarTermIds.includes(term)) ?? item.solarTermIds[0],
    };
  });
  const lines = references.map(({ citation, title, provinceName, regionName, sources }) =>
    `[案例${citation}] ${title}（${provinceName}·${regionName}）\n` +
    sources.map((source) => `${source.title.replace(/[\r\n]/gu, " ")}${source.publisher ? `｜${source.publisher}` : ""}\n${source.url}${source.accessNote ? `\n来源访问说明：${source.accessNote.replace(/[\r\n]/gu, " ")}` : ""}`).join("\n"));
  return { notes: `\n\n文化案例来源（本地已核验资料，并非本轮联网结果）\n${lines.join("\n")}`, references };
}
