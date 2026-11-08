import { SOLAR_TERMS } from "./solar-terms";

export type BookTurn = { from: number; to: number; direction: 1 | -1; serial: number };
export type BookState = { index: number; requested: number; serial: number; turn: BookTurn | null };
export type BookAction =
  | { type: "step"; delta: number; animate: boolean }
  | { type: "go"; index: number; animate: boolean }
  | { type: "complete" | "recover"; serial: number }
  | { type: "settle" };

export const INITIAL_BOOK: BookState = { index: 0, requested: 0, serial: 0, turn: null };

function settle(state: BookState): BookState {
  return state.turn ? { index: state.requested, requested: state.requested, turn: null, serial: state.serial + 1 } : state;
}

function goTo(state: BookState, destination: number, animate: boolean): BookState {
  const requested = Math.max(0, Math.min(SOLAR_TERMS.length - 1, destination));
  if (!animate) return { index: requested, requested, serial: state.serial + 1, turn: null };
  // Keep the active leaf immutable; retain only the latest pending destination.
  if (state.turn) return { ...state, requested };
  if (requested === state.index) return state;
  const serial = state.serial + 1;
  return { ...state, requested, serial, turn: { from: state.index, to: requested, direction: requested > state.index ? 1 : -1, serial } };
}

export function bookReducer(state: BookState, action: BookAction): BookState {
  if (action.type === "step") return goTo(state, state.requested + action.delta, action.animate);
  if (action.type === "go") return goTo(state, action.index, action.animate);
  if (action.type === "settle") return settle(state);
  if (!state.turn || state.turn.serial !== action.serial) return state;
  if (action.type === "recover") return settle(state);
  return goTo({ ...state, index: state.turn.to, turn: null }, state.requested, true);
}
