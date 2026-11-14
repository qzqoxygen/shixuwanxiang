import { z } from "zod";
import { CulturalCaseIdSchema, CulturalSourceSchema, ProvinceCodeSchema, SolarTermIdSchema, ChatCaseLookupSchema, ChatCaseReferencesSchema } from "./cultural-case";

export const ChatContextSchema = z.strictObject({
  solarTermId: SolarTermIdSchema.nullable(),
  provinceCode: ProvinceCodeSchema.nullable(),
  caseId: CulturalCaseIdSchema.nullable(),
});
export const EMPTY_CHAT_CONTEXT = { solarTermId: null, provinceCode: null, caseId: null } as const;
export type ChatContext = z.infer<typeof ChatContextSchema>;

export const CulturalMapStateSchema = z.strictObject({
  selectedSolarTermId: SolarTermIdSchema.nullable(),
  selectedProvinceCode: ProvinceCodeSchema.nullable(),
  selectedCaseId: CulturalCaseIdSchema.nullable(),
  highlightedProvinceCodes: z.array(ProvinceCodeSchema).max(34).refine(ids => new Set(ids).size === ids.length),
});
export type CulturalMapState = z.infer<typeof CulturalMapStateSchema>;
export const MapActionSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("SET_SOLAR_TERM"), payload: z.strictObject({ solarTermId: SolarTermIdSchema }) }),
  z.strictObject({ type: z.literal("HIGHLIGHT_PROVINCES"), payload: z.strictObject({ provinceCodes: z.array(ProvinceCodeSchema).max(34).refine(ids => new Set(ids).size === ids.length) }) }),
  z.strictObject({ type: z.literal("OPEN_CULTURAL_CASE"), payload: z.strictObject({ caseId: CulturalCaseIdSchema }) }),
]);
export const MapActionsSchema = z.array(MapActionSchema).max(8);
export type MapAction = z.infer<typeof MapActionSchema>;

export const ToolErrorCodeSchema = z.enum(["INVALID_TOOL_ARGUMENTS", "UNKNOWN_TOOL", "MAP_CONTEXT_REQUIRED", "CASE_NOT_FOUND", "CASE_CONTEXT_MISMATCH", "REGION_HAS_NO_CASES", "TOOL_TIMEOUT", "TOOL_RESULT_TOO_LARGE", "TOOL_FAILED"]);
const toolIdentity = { toolCallId: z.string().min(1).max(200), toolName: z.string().min(1).max(64) };
export const ToolEventSchema = z.discriminatedUnion("status", [
  z.strictObject({ ...toolIdentity, status: z.literal("success") }),
  z.strictObject({ ...toolIdentity, status: z.literal("error"), error: z.strictObject({ code: ToolErrorCodeSchema, message: z.string().min(1).max(300) }) }),
]);
export type ToolEvent = z.infer<typeof ToolEventSchema>;
export const CulturalReferenceSchema = CulturalSourceSchema.extend({ caseId: CulturalCaseIdSchema, caseTitle: z.string().min(1).max(100) });
export const ChatRequestV1Schema = z.strictObject({
  version: z.literal("1.0"),
  messages: z.array(z.strictObject({ role: z.enum(["user", "assistant"]), content: z.string() })).min(1).max(11),
  context: ChatContextSchema,
});
export const ChatSuccessV1Schema = z.strictObject({
  version: z.literal("1.0"),
  reply: z.string().trim().min(1).max(8000),
  answer: z.string().trim().min(1).max(8000),
  truncated: z.boolean(),
  mapActions: MapActionsSchema,
  references: z.array(CulturalReferenceSchema).max(20),
  toolEvents: z.array(ToolEventSchema).max(8),
  answerText: z.string().min(1).max(8000).optional(),
  caseReferences: ChatCaseReferencesSchema.optional(),
  caseLookup: ChatCaseLookupSchema.optional(),
  noLocalCaseMatch: z.boolean().optional(),
});
export type ChatSuccessV1 = z.infer<typeof ChatSuccessV1Schema>;
