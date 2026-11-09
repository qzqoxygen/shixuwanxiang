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
