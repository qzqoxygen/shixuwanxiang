import { CulturalMapStateSchema, MapActionsSchema, type CulturalMapState } from "./contracts/chat-api";
import type { CulturalCase } from "./contracts/cultural-case";

export class MapActionError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

// Validate the complete batch before publishing the returned state. Never mutate the caller.
export function applyValidatedMapActions(state: CulturalMapState, input: unknown, catalog: readonly CulturalCase[]): CulturalMapState {
  const parsedState = CulturalMapStateSchema.safeParse(state);
  const parsed = MapActionsSchema.safeParse(input);
  if (!parsedState.success || !parsed.success) throw new MapActionError("INVALID_MAP_ACTIONS", "地图操作格式无效。");
  let next = { ...parsedState.data, highlightedProvinceCodes: [...parsedState.data.highlightedProvinceCodes] };
  const verified = catalog.filter(item => item.verificationStatus === "verified");
  for (const action of parsed.data) {
    if (action.type === "SET_SOLAR_TERM") {
      next = { selectedSolarTermId: action.payload.solarTermId, selectedProvinceCode: null, selectedCaseId: null, highlightedProvinceCodes: [] };
      continue;
    }
    const term = next.selectedSolarTermId;
    if (!term) throw new MapActionError("MAP_CONTEXT_REQUIRED", "请先选择要查看的节气。");
    if (action.type === "HIGHLIGHT_PROVINCES") {
      if (action.payload.provinceCodes.some(code => !verified.some(item => item.solarTermIds.includes(term) &&
        (item.provinceCode === code || item.relatedProvinceCodes?.includes(code))))) {
        throw new MapActionError("REGION_HAS_NO_CASES", "部分地区没有该节气的已核验案例，地图未更新。");
      }
      next.highlightedProvinceCodes = [...action.payload.provinceCodes];
    } else {
      const item = verified.find(item => item.id === action.payload.caseId);
      if (!item) throw new MapActionError("CASE_NOT_FOUND", "未找到可公开的文化案例。");
      if (!item.solarTermIds.includes(term)) throw new MapActionError("CASE_CONTEXT_MISMATCH", "案例不属于当前节气，地图未更新。");
      next.selectedCaseId = item.id;
      next.selectedProvinceCode = item.provinceCode;
      next.highlightedProvinceCodes = [...new Set([...next.highlightedProvinceCodes, item.provinceCode])];
    }
  }
  return next;
}
