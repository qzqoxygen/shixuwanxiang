import { z } from "zod";
import { CaseListResponseSchema, ProvinceCodeSchema, SolarTermIdSchema } from "./contracts/cultural-case";
import { STUDIO_LINE_LIMIT, STUDIO_TITLE_LIMIT } from "./studio-inspiration";

export const VisitQuerySchema = z.strictObject({
  provinceCode: ProvinceCodeSchema,
  solarTermId: SolarTermIdSchema,
  area: z.string().trim().max(20).regex(/^[\p{Script=Han}·]*$/u).default(""),
});
export type VisitQuery = z.infer<typeof VisitQuerySchema>;

export const VisitMemoryRequestSchema = z.strictObject({
  solarTermId: SolarTermIdSchema,
  memory: z.string().trim().min(4).max(240),
});
export const VisitMemoryCardSchema = z.strictObject({
  solarTermId: SolarTermIdSchema,
  title: z.string().trim().min(1).max(STUDIO_TITLE_LIMIT).regex(/^[^\p{Cc}\p{Zl}\p{Zp}]+$/u),
  line: z.string().trim().min(1).max(STUDIO_LINE_LIMIT).regex(/^[^\p{Cc}\p{Zl}\p{Zp}]+$/u),
});
export const VISIT_MEMORY_KEY = "shixu.visit.memory";
export const VISIT_MEMORY_DRAFT_KEY = "shixu.visit.memory.draft";

const caseList = CaseListResponseSchema.shape.items;
const EvidenceSchema = z.strictObject({
  title: z.string().min(1).max(200),
  url: z.url({ protocol: /^https?$/u }).max(2048),
  quote: z.string().min(1).max(190),
  proof: z.string().regex(/^[0-9a-f]{64}$/u).optional(),
});
export const VisitWebSeedSchema = z.strictObject({
  query: VisitQuerySchema,
  evidence: EvidenceSchema.required({ proof: true }),
});
export type VisitWebSeed = z.infer<typeof VisitWebSeedSchema>;
export const VisitResultSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("local"), cases: caseList.min(1), answer: z.string().optional() }),
  z.strictObject({ kind: z.enum(["web", "lead"]), evidence: EvidenceSchema, nearby: caseList }),
  z.strictObject({ kind: z.literal("none"), search: z.enum(["empty", "unavailable"]), nearby: caseList }),
]);
export type VisitResult = z.infer<typeof VisitResultSchema>;
