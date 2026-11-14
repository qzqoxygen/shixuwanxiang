import { MapActionsSchema, type CulturalMapState } from "./contracts/chat-api";
import { fetchSolarTermCases } from "./cultural-case-client";
import { applyValidatedMapActions } from "./map-actions";
import type { ExploreSelection } from "./explore-selection";
import type { ProvinceCode, SolarTermId, VerifiedCulturalCase } from "./contracts/cultural-case";

export function selectionMapState(selection: ExploreSelection, highlightedProvinceCodes: ProvinceCode[]): CulturalMapState {
  return {
    selectedSolarTermId: selection.solarTermId,
    selectedProvinceCode: selection.provinceCode,
    selectedCaseId: selection.caseId,
    highlightedProvinceCodes,
  };
}

// Resolve every needed record before applying any action. Never publish a partial batch.
export async function prepareChatMapActions(state: CulturalMapState, input: unknown, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const actions = MapActionsSchema.parse(input);
  const terms = new Set<SolarTermId>();
  if (state.selectedSolarTermId) terms.add(state.selectedSolarTermId);
  for (const action of actions) if (action.type === "SET_SOLAR_TERM") terms.add(action.payload.solarTermId);
  const records = new Map<string, VerifiedCulturalCase>();
  for (const term of terms) {
    for (const item of await fetchSolarTermCases(term, signal, fetcher)) records.set(item.id, item);
  }
  signal.throwIfAborted();
  return applyValidatedMapActions(state, actions, [...records.values()]);
}
