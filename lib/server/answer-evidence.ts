import "server-only";
import { AnswerEvidenceSchema, EVIDENCE_LIMITATION, type EvidenceKind } from "../contracts/ai-evidence";
import { MAX_CHAT_CASE_REFERENCES, VerifiedCulturalCaseSchema, type CulturalCase } from "../contracts/cultural-case";
import { SUPPORTED_PROVINCES } from "../provinces";
import { SOLAR_TERMS } from "../solar-terms";
import { readCulturalCases } from "./cultural-cases";
import type { SearchContext } from "./web-search";

export class EvidenceError extends Error {
  code = "EVIDENCE_MISMATCH";
}

function reject(message: string): never { throw new EvidenceError(message); }

function descriptor(item: CulturalCase) {
  return {
    id: item.id, title: item.title, verificationStatus: item.verificationStatus,
    solarTermIds: [...item.solarTermIds].sort(), provinceCode: item.provinceCode, provinceName: item.provinceName,
    relatedProvinceCodes: [...(item.relatedProvinceCodes ?? [])].sort(), regionName: item.regionName,
    category: item.category, description: item.description, relationNote: item.relationNote, imageUrl: item.imageUrl ?? null,
    sources: item.sources.map(source => ({ title: source.title, url: source.url,
      publisher: source.publisher ?? null, accessNote: source.accessNote ?? null })).sort((a, b) => a.url.localeCompare(b.url)),
  };
}

// Re-read the server-owned catalog instead of trusting a schema-shaped object or a model label.
export function assertTrustedCaseRecords(cases: readonly CulturalCase[]) {
  if (!Array.isArray(cases) || cases.length > MAX_CHAT_CASE_REFERENCES) reject("本轮案例数量无效，未发布来源。");
  const catalog = readCulturalCases();
  const seen = new Set<string>();
  return cases.map(item => {
    const parsed = VerifiedCulturalCaseSchema.safeParse(item);
    if (!parsed.success || item.sources.length !== parsed.data.sources.length) reject("案例不是可公开的已核验记录，未发布来源。");
    const canonical = catalog.find(value => value.id === parsed.data.id && value.verificationStatus === "verified");
    if (!canonical || seen.has(canonical.id) || JSON.stringify(descriptor(parsed.data)) !== JSON.stringify(descriptor(canonical))) {
      reject("案例实体、归属或来源与知识库不一致，未发布来源。");
    }
    seen.add(canonical.id);
    return parsed.data;
  });
}

function searchSources(search?: SearchContext | null) {
  const sources = search?.sources ?? [];
  if (!Array.isArray(sources) || sources.length > 5) reject("本轮联网来源格式无效。");
  const urls = new Set<string>();
  for (const source of sources) {
    if (!source || typeof source.title !== "string" || !source.title.trim() || source.title.length > 200 || typeof source.url !== "string") reject("本轮联网来源格式无效。");
    try {
      const url = new URL(source.url);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || source.url.length > 2048 || urls.has(source.url)) reject("本轮联网来源格式无效。");
    } catch { reject("本轮联网来源格式无效。"); }
    urls.add(source.url);
  }
  return sources;
}

function checkNamedAssociations(answer: string, cases: ReturnType<typeof assertTrustedCaseRecords>) {
  const known = readCulturalCases().filter(item => item.verificationStatus === "verified");
  // Deliberately narrow: only an exact known title in a cited clause is mechanically checked.
  // This does not claim to understand every historical interpretation or implied reference.
  const clauses = answer.match(/[^\n。！？]+(?:[。！？](?:[ \t]*\[(?:案例)?[1-9]\d*\])*)?/gu) ?? [];
  for (const clause of clauses) {
    const ids = [...clause.matchAll(/\[案例([1-9]\d*)\]/gu)].map(match => Number(match[1]));
    if (!ids.length) continue;
    const cited = ids.map(id => cases[id - 1]);
    for (const named of known.filter(item => clause.includes(item.title))) {
      if (!cited.some(item => item.id === named.id)) reject("案例名称与该句引用不一致，请重新核实。");
      if (ids.length !== 1 || /相比|比较|对比|不同|区别|并非|不是|不属于|不能|未能|尚未|无法/u.test(clause)) continue;
      const terms = SOLAR_TERMS.filter(term => clause.includes(term.name));
      if (terms.length === 1 && !named.solarTermIds.includes(terms[0].id)) reject("案例节气与该句引用不一致，请重新核实。");
      // The canonical title already has a verified identity. Do not parse embedded
      // substrings such as “漠河北极村” as an unrelated 河北 province assertion.
      const attribution = clause.replaceAll(named.title, "");
      const provinces = SUPPORTED_PROVINCES.filter(province => attribution.includes(province.name.replace(/(?:壮族|回族|维吾尔)?自治区|特别行政区|省|市/gu, "")));
      if (provinces.length === 1 && named.provinceCode !== provinces[0].code && !named.relatedProvinceCodes?.includes(provinces[0].code)) {
        reject("案例地区与该句引用不一致，请重新核实。");
      }
    }
  }
}

export function validateAnswerEvidence(answer: string, input: readonly CulturalCase[], search?: SearchContext | null) {
  if (typeof answer !== "string" || !answer.trim() || answer.length > 8000) reject("回答格式无效，无法核对证据。");
  const cases = assertTrustedCaseRecords(input);
  const web = searchSources(search);
  const localLabels = answer.match(/\[案例[^\]\r\n]*\]?/gu) ?? [];
  const webLabels = answer.match(/\[\d[^\]\r\n]*\]?/gu) ?? [];
  if (localLabels.some(label => !/^\[案例[1-9]\d*\]$/u.test(label)) || webLabels.some(label => !/^\[[1-9]\d*\]$/u.test(label))) {
    reject("引用编号格式无效，请重新核实。");
  }
  const local = [...answer.matchAll(/\[案例([1-9]\d*)\]/gu)].map(match => Number(match[1]));
  const numeric = [...answer.matchAll(/\[([1-9]\d*)\]/gu)].map(match => Number(match[1]));
  if (local.some(id => id > cases.length) || numeric.some(id => id > web.length)) reject("引用编号没有对应本轮真实来源，请重新核实。");
  const allowedUrls = new Set([...cases.flatMap(item => item.sources.map(source => source.url)), ...web.map(source => source.url)]);
  const urls = answer.match(/https?:\/\/[^\s<>"'）)\]，。；！？]+/gu) ?? [];
  if (urls.some(url => !allowedUrls.has(url.replace(/[.;]+$/u, "")))) reject("回答包含非本轮资料的来源链接，请重新核实。");
  checkNamedAssociations(answer, cases);
  return { localCitations: [...new Set(local)], webCitations: [...new Set(numeric)],
    localCitationCount: local.length, webCitationCount: numeric.length, validCitationCount: local.length + numeric.length };
}

export function buildAnswerEvidence(answer: string, input: readonly CulturalCase[], search?: SearchContext | null) {
  const result = validateAnswerEvidence(answer, input, search);
  const cases = assertTrustedCaseRecords(input);
  const web = searchSources(search);
  const kinds: EvidenceKind[] = [];
  if (cases.length) kinds.push("local_verified");
  if (web.length) kinds.push("live_search");
  kinds.push("general_knowledge");
  if (search === null || (search !== undefined && !web.length) || (cases.length && !result.localCitationCount) ||
    /无法核实|尚未核实|未查到|未找到|暂未找到|缺少.{0,8}(?:证据|依据)/u.test(answer)) kinds.push("insufficient_evidence");
  return AnswerEvidenceSchema.parse({
    method: "local_knowledge_retrieval", kinds,
    localCases: cases.map((item, index) => ({ citation: index + 1, caseId: item.id, title: item.title,
      solarTermIds: item.solarTermIds, provinceCode: item.provinceCode, provinceName: item.provinceName,
      ...(item.relatedProvinceCodes ? { relatedProvinceCodes: item.relatedProvinceCodes } : {}), regionName: item.regionName,
      sources: item.sources, cited: result.localCitations.includes(index + 1) })),
    webSources: web.map((source, index) => ({ citation: index + 1, title: source.title, url: source.url, cited: result.webCitations.includes(index + 1) })),
    searchStatus: web.length ? "available" : search === undefined ? "not_requested" : "failed",
    checks: { entityFields: true, citationLinks: true, statementTruth: false, localCitationCount: result.localCitationCount, webCitationCount: result.webCitationCount },
    limitation: EVIDENCE_LIMITATION,
  });
}
