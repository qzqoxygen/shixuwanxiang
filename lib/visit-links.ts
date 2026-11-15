import type { ProvinceCode } from "./provinces";
import type { SolarTermId } from "./solar-terms";
import { VISIT_MEMORY_DRAFT_KEY, VISIT_MEMORY_KEY, VisitQuerySchema, type VisitQuery } from "./solar-visit";
import { ProvinceCodeSchema, SolarTermIdSchema } from "./contracts/cultural-case";

type VisitFilters = { provinceCode?: ProvinceCode | null; solarTermId?: SolarTermId | null; area?: string };
type Params = Record<string, string | string[] | undefined>;

export const DEFAULT_VISIT: VisitQuery = { provinceCode: "330000", solarTermId: "dongzhi", area: "" };

export function visitHref({ provinceCode, solarTermId, area }: VisitFilters = {}) {
  const params = new URLSearchParams();
  if (solarTermId) params.set("solarTermId", solarTermId);
  if (provinceCode) params.set("provinceCode", provinceCode);
  if (provinceCode && area) params.set("area", area);
  return params.size ? `/visit?${params}` : "/visit";
}

export function readVisitFilters(params: Params): VisitQuery {
  const province = ProvinceCodeSchema.safeParse(params.provinceCode);
  const term = SolarTermIdSchema.safeParse(params.solarTermId);
  const fallback = { provinceCode: province.data ?? DEFAULT_VISIT.provinceCode, solarTermId: term.data ?? DEFAULT_VISIT.solarTermId };
  return VisitQuerySchema.safeParse({ ...fallback, area: province.success ? params.area : undefined }).data ?? { ...fallback, area: "" };
}

export function visitLinkParams(query: VisitQuery) {
  return { visitTerm: query.solarTermId, visitProvince: query.provinceCode, visitArea: query.area };
}

export function readVisitOrigin(params: Params) {
  return VisitQuerySchema.safeParse({ solarTermId: params.visitTerm, provinceCode: params.visitProvince, area: params.visitArea }).data;
}

export function visitMemoryKeys(query?: VisitQuery) {
  const suffix = query ? `:${visitHref(query)}` : "";
  return { card: VISIT_MEMORY_KEY + suffix, draft: VISIT_MEMORY_DRAFT_KEY + suffix };
}

export function visitWebKey(query: VisitQuery) {
  return `shixu.visit.web:${visitHref(query)}`;
}
