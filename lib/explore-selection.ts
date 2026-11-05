import type { ProvinceCode } from "./provinces";
import type { SolarTermId } from "./solar-terms";

export const CASE_PAGE_SIZE = 6;
export const INITIAL_EXPLORE_SELECTION = { solarTermId: null, provinceCode: null, caseId: null, offset: 0 } as const;
export type ExploreSelection = {
  solarTermId: SolarTermId | null;
  provinceCode: ProvinceCode | null;
  caseId: string | null;
  offset: number;
};
export type ExploreSelectionAction =
  | { type: "term"; value: SolarTermId | null }
  | { type: "province"; value: ProvinceCode | null }
  | { type: "page"; value: number }
  | { type: "open"; caseId: string; provinceCode: ProvinceCode }
  | { type: "close" }
  | { type: "reset" };

export function exploreSelectionReducer(state: ExploreSelection, action: ExploreSelectionAction): ExploreSelection {
  switch (action.type) {
    case "term": return { ...INITIAL_EXPLORE_SELECTION, solarTermId: action.value };
    case "province": return action.value === state.provinceCode ? state : { ...state, provinceCode: action.value, caseId: null, offset: 0 };
    case "page": return { ...state, offset: action.value, caseId: null };
    case "open": return { ...state, provinceCode: action.provinceCode, caseId: action.caseId, offset: action.provinceCode === state.provinceCode ? state.offset : 0 };
    case "close": return { ...state, caseId: null };
    case "reset": return INITIAL_EXPLORE_SELECTION;
  }
}
