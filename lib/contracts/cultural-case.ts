import { z } from "zod";
import { SOLAR_TERMS } from "../solar-terms";
import { SUPPORTED_PROVINCES } from "../provinces";

export type { SolarTermId } from "../solar-terms";
export type { ProvinceCode } from "../provinces";

// The contract measures UTF-16 units, rather than Unicode code points.
const text = (max: number) => z.string().trim().min(1).refine((value) => value.length <= max);

export const SolarTermIdSchema = z.enum(SOLAR_TERMS.map((term) => term.id));
export const ProvinceCodeSchema = z.enum(SUPPORTED_PROVINCES.map((province) => province.code));
export const CulturalCaseIdSchema = z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9-]*$/);
export const CulturalCategorySchema = z.enum(["folk_custom", "agriculture", "craft", "food", "other"]);

export const CulturalSourceSchema = z.strictObject({
  title: text(200),
  url: text(2048).refine((value) => {
    try {
      return /^https?:\/\//i.test(value) && ["http:", "https:"].includes(new URL(value).protocol);
    } catch { return false; }
  }, "来源必须是绝对 HTTP(S) URL。"),
  publisher: text(100).optional(),
  accessNote: text(300).optional(),
});

// No external image domains have been approved for this batch.
const ImageUrlSchema = text(2048).refine((value) => {
  if (!value.startsWith("/images/") || value.includes("\\")) return false;
  try {
    const path = decodeURIComponent(value.split(/[?#]/)[0]);
    return !path.includes("\\") && new URL(path, "https://local.invalid").pathname.startsWith("/images/") && path.length > 8;
  } catch { return false; }
}, "图片必须使用本站 /images/ 路径；外部域名尚未获批。");

export const CulturalCaseSchema = z.strictObject({
  id: CulturalCaseIdSchema,
  title: text(100),
  solarTermIds: z.array(SolarTermIdSchema).min(1).max(24).refine((ids) => new Set(ids).size === ids.length),
  provinceCode: ProvinceCodeSchema,
  provinceName: text(100),
  // A regional custom stays one entity; other supported provinces are filterable too.
  relatedProvinceCodes: z.array(ProvinceCodeSchema).min(1).max(33).refine((codes) => new Set(codes).size === codes.length).optional(),
  regionName: text(100),
  category: CulturalCategorySchema,
  description: text(2000),
  relationNote: text(1000),
  sources: z.array(CulturalSourceSchema).min(1).max(5).transform((sources) => sources.filter((source, index) => sources.findIndex((item) => item.url === source.url) === index)),
  verificationStatus: z.enum(["verified", "pending"]),
  imageUrl: ImageUrlSchema.optional(),
}).refine((item) => SUPPORTED_PROVINCES.some((province) => province.code === item.provinceCode && province.name === item.provinceName), {
  message: "省份名称必须与地图编码对应。", path: ["provinceName"],
}).refine((item) => !item.relatedProvinceCodes?.includes(item.provinceCode), {
  message: "关联省份不得重复主省份。", path: ["relatedProvinceCodes"],
});

export const VerifiedCulturalCaseSchema = CulturalCaseSchema.safeExtend({ verificationStatus: z.literal("verified") });
export const CulturalCaseCollectionSchema = z.array(CulturalCaseSchema).refine((items) => new Set(items.map((item) => item.id)).size === items.length, "案例 ID 不得重复。");

const OffsetSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const LimitSchema = z.number().int().min(1).max(20);

export const CaseListQuerySchema = z.strictObject({
  solarTermId: SolarTermIdSchema.optional(),
  provinceCode: ProvinceCodeSchema.optional(),
  category: CulturalCategorySchema.optional(),
  keyword: z.string().trim().refine((value) => value.length <= 100).transform((value) => value || undefined).optional(),
  offset: OffsetSchema.default(0),
  limit: LimitSchema.default(10),
});

const decimal = z.string().regex(/^[0-9]+$/).transform(Number);
const HttpQuerySchema = CaseListQuerySchema.extend({
  offset: decimal.pipe(OffsetSchema).default(0),
  limit: decimal.pipe(LimitSchema).default(10),
});

export function parseCaseListQuery(searchParams: URLSearchParams): CaseListQuery {
  const values: Record<string, string> = {};
  for (const [key, value] of searchParams) {
    if (Object.hasOwn(values, key)) throw new Error("不允许重复查询参数。");
    Object.defineProperty(values, key, { value, enumerable: true });
  }
  return HttpQuerySchema.parse(values);
}

export const CaseListResponseSchema = z.strictObject({
  version: z.literal("1.0"),
  items: z.array(VerifiedCulturalCaseSchema),
  total: OffsetSchema,
  offset: OffsetSchema,
  limit: LimitSchema,
});
export const CaseDetailResponseSchema = z.strictObject({ version: z.literal("1.0"), item: VerifiedCulturalCaseSchema });
export const ApiFailureSchema = z.strictObject({
  version: z.literal("1.0"),
  answer: z.null(),
  truncated: z.literal(false),
  error: z.strictObject({ code: text(100), message: text(2000) }),
});

export type CulturalCaseId = z.infer<typeof CulturalCaseIdSchema>;
export type CulturalCategory = z.infer<typeof CulturalCategorySchema>;
export type CulturalSource = z.infer<typeof CulturalSourceSchema>;
export type CulturalCase = z.infer<typeof CulturalCaseSchema>;
export type VerifiedCulturalCase = z.infer<typeof VerifiedCulturalCaseSchema>;
export type CaseListQuery = z.infer<typeof CaseListQuerySchema>;
export type CaseListResponse = z.infer<typeof CaseListResponseSchema>;
export type CaseDetailResponse = z.infer<typeof CaseDetailResponseSchema>;
export type ApiFailure = z.infer<typeof ApiFailureSchema>;
