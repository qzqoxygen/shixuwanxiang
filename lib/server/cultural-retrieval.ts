import "server-only";
import type { ChatMessage } from "../chat";
import type { CulturalCase, CulturalCategory, VerifiedCulturalCase } from "../contracts/cultural-case";
import type { RetrievalDiagnostic } from "../contracts/retrieval";
import { CULTURAL_CASE_ALIASES, normalizeCulturalQuery } from "../cultural-aliases";
import { SUPPORTED_PROVINCES } from "../provinces";
import { SOLAR_TERMS } from "../solar-terms";

const followUp = /^(那|那么|这[个些两]|它|当地|那里|还有|具体|详细|继续|来源|链接|再|换成|比较|对比|分别|只看|仅看)/u;
const cultureQuestion = /习俗|民俗|风俗|传统|文化|案例|故事|非遗|技艺|农事|手艺|祭|吃|喝|酿|织|制作|活动|意象|文创|创意|饮食|节俗|风物|地方|收录/u;
const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });
const genericWords = new Set(["介绍", "讲讲", "请问", "关于", "什么", "哪些", "如何", "怎么", "这个", "这些", "那里", "当地", "还有", "具体", "详细", "继续", "来源", "链接", "文化", "案例", "地方", "传统", "习俗", "民俗", "节气", "相关", "知识", "饮食", "地区", "一带", "比较", "对比", "不同", "区别", "特点", "特色", "分别", "资料", "出处", "原文", "证据", "查询", "查找", "看看", "告诉", "有关", "两个", "两地", "两省", "这些", "一样", "只看", "仅看", "食物", "美食", "小吃", "农事", "农耕", "技艺", "手工", "工艺", "祭祀类", "祭祖类", "民俗类", "礼俗类", "有什么", "有没有", "已核实", "已核验", "收录", "一则", "请介绍", "冬节"]);
const normalizeName = (text: string) => normalizeCulturalQuery(text).text.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
const provincesFor = (item: CulturalCase) => [item.provinceCode, ...(item.relatedProvinceCodes ?? [])];

function words(text: string): string[] {
  const tokens: string[] = [];
  let characters = "";
  const content = text.replace(/^(?:(?:那(?:么)?|再|请|只看|仅看|继续|比较|对比)\s*)+/u, "");
  for (const { segment, isWordLike } of segmenter.segment(content)) {
    if (isWordLike && segment.length === 1) { characters += segment; continue; }
    if (characters) { tokens.push(characters); characters = ""; }
    if (isWordLike) tokens.push(segment);
  }
  if (characters) tokens.push(characters);
  return tokens.map(word => word.replace(/(?:省|市|县|区)$/u, "")).filter(word => word.length >= 2 && !genericWords.has(word));
}

function dimensions(text: string, locations: readonly string[] = []) {
  // Known local names such as 漠河 + 北极村 must not become the province 河北.
  let provinceText = text;
  for (const location of locations) provinceText = provinceText.replaceAll(location, " ");
  const segments = [...segmenter.segment(provinceText)].filter(item => item.isWordLike).map(item => item.segment);
  return {
    terms: SOLAR_TERMS.filter(({ name }) => text.includes(name)).map(({ id }) => id),
    provinces: SUPPORTED_PROVINCES.filter(({ name }) => {
      const short = name.replace(/(?:壮族|回族|维吾尔)?自治区|特别行政区|省|市/gu, "");
      return segments.some(segment => segment === short || (segment.startsWith(short) && /^(?:省|市|人|地区|自治区|特别行政区)/u.test(segment.slice(short.length))));
    }).map(({ code }) => code),
  };
}

function categoryFor(text: string): CulturalCategory | undefined {
  if (/饮食|美食|小吃|食物|吃的/u.test(text)) return "food";
  if (/农事|农耕|耕作|播种/u.test(text)) return "agriculture";
  if (/技艺|手工|工艺/u.test(text)) return "craft";
  if (/民俗类|礼俗类|祭祀类|祭祖类/u.test(text)) return "folk_custom";
  return undefined;
}

export function retrieveCulturalCases(history: readonly ChatMessage[], catalog: readonly CulturalCase[], limit: number) {
  const questions = history.filter(message => message.role === "user").map(message => normalizeCulturalQuery(message.content));
  const latest = questions.at(-1)?.text ?? "";
  const verified = catalog.filter((item): item is VerifiedCulturalCase => item.verificationStatus === "verified");
  const provinceNames = new Set(SUPPORTED_PROVINCES.map(({ name }) => name.replace(/(?:壮族|回族|维吾尔)?自治区|特别行政区|省|市/gu, "")));
  const locations = [...new Set(verified.flatMap(item => [...item.regionName.matchAll(/[\p{Script=Han}]{1,12}?(?:地区|省|市|县|区|镇|乡|村)/gu)]
    .map(match => match[0].replace(/(?:地区|省|市|县|区|镇|乡|村)$/u, "")).filter(name => name.length >= 2 && !provinceNames.has(name))))].sort((a, b) => b.length - a.length);
  let start = questions.length - 1;
  while (start > 0 && followUp.test(questions[start].text)) start--;
  const topics = questions.slice(Math.max(0, start)).map(question => question.text).reverse();
  const exactIds = new Set(verified.filter(item => normalizeName(latest).includes(normalizeName(item.title))).map(item => item.id));
  let explicitText = exactIds.size ? normalizeName(latest) : latest;
  for (const item of verified) if (exactIds.has(item.id)) explicitText = explicitText.replaceAll(normalizeName(item.title), " ");
  const current = dimensions(explicitText, locations);
  const exactCases = verified.filter(item => exactIds.has(item.id));
  const terms = current.terms.length ? current.terms : exactCases.length ? [...new Set(exactCases.flatMap(item => item.solarTermIds))]
    : topics.map(topic => dimensions(topic, locations).terms).find(ids => ids.length) ?? [];
  const category = topics.map(categoryFor).find(Boolean);
  const dimensionsWords = new Set(topics.flatMap(topic => {
    const found = dimensions(topic, locations);
    return [...found.terms.flatMap(id => words(SOLAR_TERMS.find(term => term.id === id)!.name)),
      ...found.provinces.flatMap(code => words(SUPPORTED_PROVINCES.find(province => province.code === code)!.name))];
  }));
  const queryWords = [...new Set(topics.flatMap(words))].filter(word => !dimensionsWords.has(word));
  const regions = words(explicitText).filter(word => !dimensionsWords.has(word) && verified.some(item => item.regionName.includes(word)));
  const keywords = queryWords.filter(word => !regions.includes(word));
  const provinces = current.provinces.length ? current.provinces : regions.length ? []
    : exactCases.length ? [...new Set(exactCases.flatMap(provincesFor))] : topics.map(topic => dimensions(topic, locations).provinces).find(codes => codes.length) ?? [];
  const aliases = new Map(verified.flatMap(item => {
    const found = (CULTURAL_CASE_ALIASES[item.id] ?? []).filter(alias => normalizeName(latest).includes(normalizeName(alias)));
    return found.length ? [[item.id, found] as const] : [];
  }));
  const filtered = verified.filter(item => (!category || item.category === category) &&
    (!terms.length || item.solarTermIds.some(id => terms.includes(id))) &&
    (!provinces.length || provincesFor(item).some(code => provinces.includes(code))) &&
    (!regions.length || regions.some(region => item.regionName.includes(region))));
  const ranked = filtered.map(item => {
    const fields = new Set<RetrievalDiagnostic["scores"][number]["matchedFields"][number]>();
    let score = 0;
    if (exactIds.has(item.id)) { score += 1000; fields.add("title"); }
    if (aliases.has(item.id)) { score += 40; fields.add("alias"); }
    for (const word of keywords) {
      if (normalizeCulturalQuery(item.title).text.includes(word)) { score += 4; fields.add("title"); }
      else if (item.regionName.includes(word)) { score += 3; fields.add("region"); }
      else if (item.description.includes(word)) { score += 1; fields.add("description"); }
      else if (item.relationNote.includes(word)) { score += 1; fields.add("relationNote"); }
    }
    return { item, score, matchedFields: [...fields] };
  });
  const exact = ranked.filter(entry => exactIds.has(entry.item.id));
  const hasKeywords = ranked.some(entry => entry.score > 0);
  const hasCultureTopic = topics.some(topic => cultureQuestion.test(topic)) ||
    (provinces.length > 1 && /比较|对比|不同|区别/u.test(latest));
  const notCultural = !exact.length && !aliases.size && !hasCultureTopic && (!hasKeywords || /黄经|黄道|公转|自转|直射|昼夜|白昼|气温|天气|温度|气候|最冷|最热/u.test(latest));
  const specific = keywords.length > 0;
  const ordered = (notCultural ? [] : exact.length ? exact : ranked.filter(entry => hasKeywords ? entry.score > 0 : !specific && (terms.length || provinces.length)))
    .sort((a, b) => b.score - a.score || (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0));
  const reserved = new Set<string>();
  for (const code of provinces) {
    const candidate = ordered.find(({ item }) => provincesFor(item).includes(code));
    if (candidate && reserved.size < limit) reserved.add(candidate.item.id);
  }
  for (const { item } of ordered) if (reserved.size < limit) reserved.add(item.id);
  const selected = ordered.filter(({ item }) => reserved.has(item.id));
  const matched = selected.map(({ item }) => item);
  const noMatch = matched.length === 0 && !notCultural && (hasCultureTopic || aliases.size > 0 || exactIds.size > 0);
  const diagnostics: RetrievalDiagnostic = {
    strategy: notCultural ? "not_cultural" : !matched.length ? "no_match" : exact.length ? "exact_title" : aliases.size ? "alias" : hasKeywords ? "ranked" : "filters_only",
    solarTermIds: terms, provinceCodes: provinces, regions: regions.slice(0, 20), ...(category ? { category } : {}),
    normalizedTerms: keywords.slice(0, 20).map(word => word.slice(0, 100)),
    matchedAliases: [...new Set([...questions.slice(Math.max(0, start)).flatMap(question => question.aliases), ...aliases.values()].flat())].slice(0, 20),
    candidateCount: filtered.length, matchedCount: ordered.length,
    matchedIds: matched.map(item => item.id), scores: selected.map(({ item, score, matchedFields }) => ({ caseId: item.id, score, matchedFields: matchedFields.length ? matchedFields : ["filters"] })),
    ...(!matched.length ? { noMatchReason: notCultural ? "not_cultural" as const : !filtered.length ? "no_public_match" as const : exactIds.size || aliases.size ? "filters_conflict" as const : "no_keyword_match" as const } : {}),
  };
  return { cases: matched, terms, noMatch, diagnostics };
}
