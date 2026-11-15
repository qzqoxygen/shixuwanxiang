import type { CulturalSource } from "./contracts/cultural-case";
import type { ProvinceCode } from "./provinces";
import type { SolarTermId } from "./solar-terms";

export const STUDIO_TITLE_LIMIT = 12;
export const STUDIO_LINE_LIMIT = 56;

export const STUDIO_FORMATS = {
  "field-notes": "风物笺",
  centered: "留白笺",
  bookmark: "书签",
  poster: "画报",
} as const;

export type StudioFormat = keyof typeof STUDIO_FORMATS;
export type StudioSuggestion = { title: string; line: string };
export type StudioReference = { caseId: string; title: string; provinceName: string; regionName: string; sources: CulturalSource[] };
export type StudioCaseSeed = Pick<StudioReference, "caseId" | "title" | "provinceName" | "regionName"> & {
  solarTermId: SolarTermId;
  provinceCode: ProvinceCode;
};

export function studioCaseHref({ caseId, solarTermId }: Pick<StudioCaseSeed, "caseId" | "solarTermId">, params?: Record<string, string>) {
  return `/studio?${new URLSearchParams({ ...params, caseId, solarTermId })}`;
}

export function isStudioFormat(value: string | null): value is StudioFormat {
  return value !== null && Object.hasOwn(STUDIO_FORMATS, value);
}

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= max && !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(text) ? text : null;
}

export function readStudioSuggestions(value: unknown): StudioSuggestion[] {
  if (!value || typeof value !== "object" || !("suggestions" in value) || !Array.isArray(value.suggestions)) return [];
  const suggestions: StudioSuggestion[] = [];
  for (const item of value.suggestions) {
    if (!item || typeof item !== "object") continue;
    const title = cleanText(item.title, STUDIO_TITLE_LIMIT);
    const line = cleanText(item.line, STUDIO_LINE_LIMIT);
    if (!title || !line || suggestions.some((existing) => existing.title === title || existing.line === line)) continue;
    suggestions.push({ title, line });
    if (suggestions.length === 3) break;
  }
  return suggestions;
}

export function readStudioReferences(value: unknown): StudioReference[] {
  if (!value || typeof value !== "object" || !("references" in value) || !Array.isArray(value.references)) return [];
  return value.references.slice(0, 20).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const caseId = cleanText(item.caseId, 64);
    const title = cleanText(item.title, 100);
    const provinceName = cleanText(item.provinceName, 100);
    const regionName = cleanText(item.regionName, 100);
    if (!caseId || !/^[a-z0-9][a-z0-9-]*$/u.test(caseId) || !title || !provinceName || !regionName || !Array.isArray(item.sources)) return [];
    const sources: CulturalSource[] = item.sources.slice(0, 5).flatMap((source: unknown) => {
      if (!source || typeof source !== "object" || !("title" in source) || !("url" in source)) return [];
      const title = cleanText(source.title, 200);
      const url = cleanText(source.url, 2048);
      if (!title || !url) return [];
      try { if (!["http:", "https:"].includes(new URL(url).protocol)) return []; } catch { return []; }
      const publisher = "publisher" in source ? cleanText(source.publisher, 100) : null;
      const accessNote = "accessNote" in source ? cleanText(source.accessNote, 300) : null;
      return [{ title, url, ...(publisher ? { publisher } : {}), ...(accessNote ? { accessNote } : {}) }];
    });
    return sources.length ? [{ caseId, title, provinceName, regionName, sources }] : [];
  });
}
