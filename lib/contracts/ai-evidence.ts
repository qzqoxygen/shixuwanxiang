import { z } from "zod";
import { CulturalCaseIdSchema, CulturalSourceSchema, MAX_CHAT_CASE_REFERENCES, ProvinceCodeSchema, SolarTermIdSchema } from "./cultural-case";

export const EVIDENCE_LIMITATION = "仅校验实体、归属与引用关联；模型解释未经逐句事实核验。";
export const EvidenceKindSchema = z.enum(["local_verified", "live_search", "general_knowledge", "insufficient_evidence"]);
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;
const sourceUrl = z.string().max(2048).refine(value => {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
});

export const AnswerEvidenceSchema = z.strictObject({
  method: z.literal("local_knowledge_retrieval"),
  kinds: z.array(EvidenceKindSchema).min(1).max(4).refine(values => new Set(values).size === values.length),
  localCases: z.array(z.strictObject({
    citation: z.number().int().min(1).max(MAX_CHAT_CASE_REFERENCES),
    caseId: CulturalCaseIdSchema,
    title: z.string().min(1).max(100),
    solarTermIds: z.array(SolarTermIdSchema).min(1).max(24),
    provinceCode: ProvinceCodeSchema,
    provinceName: z.string().min(1).max(100),
    relatedProvinceCodes: z.array(ProvinceCodeSchema).max(33).optional(),
    regionName: z.string().min(1).max(100),
    sources: z.array(CulturalSourceSchema).min(1).max(5),
    cited: z.boolean(),
  })).max(MAX_CHAT_CASE_REFERENCES),
  webSources: z.array(z.strictObject({
    citation: z.number().int().min(1).max(5), title: z.string().min(1).max(200), url: sourceUrl, cited: z.boolean(),
  })).max(5),
  searchStatus: z.enum(["not_requested", "available", "failed"]),
  checks: z.strictObject({
    entityFields: z.literal(true), citationLinks: z.literal(true), statementTruth: z.literal(false),
    localCitationCount: z.number().int().min(0).max(8000), webCitationCount: z.number().int().min(0).max(8000),
  }),
  limitation: z.literal(EVIDENCE_LIMITATION),
});
export type AnswerEvidence = z.infer<typeof AnswerEvidenceSchema>;
