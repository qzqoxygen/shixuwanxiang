import { SOLAR_TERMS, type SolarTermId } from "./solar-terms";
import { isStudioFormat, STUDIO_LINE_LIMIT, STUDIO_TITLE_LIMIT, type StudioFormat } from "./studio-inspiration";

export const STUDIO_DRAFT_KEY = "shixu.studio.draft.v1";

export const STUDIO_PALETTES = [
  { id: "celadon", name: "宣纸青绿" },
  { id: "ink-blue", name: "烟墨蓝" },
  { id: "ochre", name: "暖砂赭" },
] as const;
export const STUDIO_DECORATIONS = [
  { id: "template", name: "随模板" },
  { id: "none", name: "无" },
  { id: "line", name: "细线框" },
  { id: "double", name: "双线框" },
  { id: "paper", name: "宣纸纹" },
] as const;

export type StudioPlacement = { x: number; y: number; size: number; angle: number };
type DraftSticker = StudioPlacement & { id: number; assetId: string; mirrored: boolean };
export type StudioDraft = {
  version: 1;
  termId: SolarTermId;
  templateId: StudioFormat;
  paletteId: (typeof STUDIO_PALETTES)[number]["id"];
  decoration: (typeof STUDIO_DECORATIONS)[number]["id"];
  title: string | null;
  line: string | null;
  date: StudioPlacement | null;
  stickers: DraftSticker[];
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function readPlacement(value: unknown, minSize: number, maxSize: number): StudioPlacement | null {
  if (!record(value)) return null;
  const { x, y, size, angle } = value;
  return inRange(x, 0, 100) && inRange(y, 0, 100) && inRange(size, minSize, maxSize) && inRange(angle, 0, 360)
    ? { x, y, size, angle } : null;
}

export function parseStudioDraft(snapshot: string | null): StudioDraft | null {
  if (!snapshot) return null;
  let value: unknown;
  try { value = JSON.parse(snapshot); } catch { return null; }
  if (!record(value) || value.version !== 1 || !Array.isArray(value.stickers)) return null;

  const term = SOLAR_TERMS.find(({ id }) => id === value.termId);
  const palette = STUDIO_PALETTES.find(({ id }) => id === value.paletteId);
  const decoration = STUDIO_DECORATIONS.find(({ id }) => id === value.decoration);
  const { templateId } = value;
  if (!term || !palette || !decoration || typeof templateId !== "string" || !isStudioFormat(templateId)) return null;

  const stickers: DraftSticker[] = [];
  const usedIds = new Set<number>();
  for (const entry of value.stickers) {
    if (!record(entry) || !inRange(entry.id, 0, Number.MAX_SAFE_INTEGER - 1) || !Number.isSafeInteger(entry.id)
      || typeof entry.assetId !== "string" || usedIds.has(entry.id)) continue;
    const placement = readPlacement(entry, 16, 76);
    if (!placement) continue;
    usedIds.add(entry.id);
    stickers.push({ ...placement, id: entry.id, assetId: entry.assetId, mirrored: entry.mirrored === true });
  }

  return {
    version: 1,
    termId: term.id,
    templateId,
    paletteId: palette.id,
    decoration: decoration.id,
    title: typeof value.title === "string" && value.title.length <= STUDIO_TITLE_LIMIT ? value.title : null,
    line: typeof value.line === "string" && value.line.length <= STUDIO_LINE_LIMIT ? value.line : null,
    date: readPlacement(value.date, 60, 220),
    stickers,
  };
}
