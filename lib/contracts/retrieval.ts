import { z } from "zod";
import { CulturalCaseIdSchema, CulturalCategorySchema, ProvinceCodeSchema, SolarTermIdSchema } from "./cultural-case";

export const RetrievalDiagnosticSchema = z.strictObject({
  strategy: z.enum(["exact_title", "alias", "ranked", "filters_only", "not_cultural", "no_match", "comparison"]),
  solarTermIds: z.array(SolarTermIdSchema).max(24),
  provinceCodes: z.array(ProvinceCodeSchema).max(34),
  regions: z.array(z.string().min(1).max(100)).max(20),
  category: CulturalCategorySchema.optional(),
  normalizedTerms: z.array(z.string().min(1).max(100)).max(20),
  matchedAliases: z.array(z.string().min(1).max(40)).max(20),
  candidateCount: z.number().int().min(0),
  matchedCount: z.number().int().min(0),
  matchedIds: z.array(CulturalCaseIdSchema).max(79),
  scores: z.array(z.strictObject({
    caseId: CulturalCaseIdSchema,
    score: z.number().nonnegative(),
    matchedFields: z.array(z.enum(["title", "region", "description", "relationNote", "alias", "filters"])).max(6),
  })).max(79),
  noMatchReason: z.enum(["not_cultural", "no_public_match", "filters_conflict", "no_keyword_match"]).optional(),
});
export type RetrievalDiagnostic = z.infer<typeof RetrievalDiagnosticSchema>;
