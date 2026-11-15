import "server-only";
import type { ChatMessage } from "../chat";
import { CulturalCaseIdSchema, MAX_CHAT_CASE_REFERENCES, type ChatCaseReference, type CulturalCase, type VerifiedCulturalCase } from "../contracts/cultural-case";
import { SUPPORTED_PROVINCES } from "../provinces";
import { SOLAR_TERMS, type SolarTermId } from "../solar-terms";
import { findVerifiedCulturalCase, queryCulturalCases } from "./cultural-case-query";
import { readCulturalCases } from "./cultural-cases";
import { retrieveCulturalCases } from "./cultural-retrieval";

// Local, explainable lexical retrieval. Assistant history is never evidence.
export function retrieveChatCases(history: readonly ChatMessage[], cases: readonly CulturalCase[] = readCulturalCases(), limit = MAX_CHAT_CASE_REFERENCES) {
  return retrieveCulturalCases(history, cases, limit);
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
