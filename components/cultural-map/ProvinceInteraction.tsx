"use client";

import Link from "next/link";
import { createContext, useContext, useId, useRef, useState, type ReactNode } from "react";
import { ProvinceCodeSchema, type ProvinceCode } from "@/lib/contracts/cultural-case";
import { exploreSelectionReducer, INITIAL_EXPLORE_SELECTION, type ExploreSelection, type ExploreSelectionAction } from "@/lib/explore-selection";
import { prepareChatMapActions, selectionMapState } from "@/lib/chat-map-client";
import type { ChatContext, MapAction } from "@/lib/contracts/chat-api";
import type { VisitQuery } from "@/lib/solar-visit";
import { visitHref } from "@/lib/visit-links";
import { MAP_GEOMETRY_URL } from "@/lib/map-assets";
import PaperLandscape from "./PaperLandscape";
import { useProvinceCases, type ProvinceCases } from "./useProvinceCases";

export type ProvinceView = {
  id: string;
  name: string;
  shortName: string;
  anchor: readonly [number, number];
  label: readonly [number, number];
  scenery?: { x: number; y: number; scale: number };
};

type Interaction = {
  selection: ExploreSelection;
  visitOrigin?: VisitQuery;
  dispatch: (action: ExploreSelectionAction) => void;
  revision: number;
  getMapRevision: () => number;
  getChatContext: () => ChatContext;
  invalidateMapRevision: () => void;
  highlightedProvinceCodes: ProvinceCode[];
  applyAiMapActions: (actions: MapAction[], expectedRevision: number, signal: AbortSignal) => Promise<void>;
  provinces: ProvinceView[];
  selected: string | null;
  raised: string | null;
  matchingCases: ProvinceCases;
  retryMatchingCases: () => void;
  setSelected: (id: string | null) => void;
  setHovered: (id: string | null) => void;
  setFocused: (id: string | null) => void;
};
const ProvinceContext = createContext<Interaction | null>(null);
export function useProvinces() {
  const context = useContext(ProvinceContext);
  if (!context) throw new Error("Province controls require their map provider");
  return context;
}

export function ProvinceInteraction({ provinces, children, initialSelection = INITIAL_EXPLORE_SELECTION, visitOrigin }: {
  provinces: ProvinceView[]; children: ReactNode; initialSelection?: ExploreSelection; visitOrigin?: VisitQuery;
}) {
  const [view, setView] = useState({ selection: initialSelection, highlightedProvinceCodes: [] as ProvinceCode[], revision: 0 });
  const current = useRef(view);
  const { selection, highlightedProvinceCodes, revision } = view;
  function publish(next: typeof view) { current.current = next; setView(next); }
  function dispatch(action: ExploreSelectionAction) {
    const previous = current.current;
    const next = exploreSelectionReducer(previous.selection, action);
    let highlighted = previous.highlightedProvinceCodes;
    if (action.type === "term" || action.type === "reset") highlighted = [];
    if (action.type === "locate") highlighted = [...new Set([...(previous.selection.solarTermId === action.solarTermId ? highlighted : []), action.provinceCode])];
    if (action.type === "applyMap") highlighted = action.value.highlightedProvinceCodes;
    publish({ selection: next, highlightedProvinceCodes: highlighted, revision: previous.revision + 1 });
  }
  const getMapRevision = () => current.current.revision;
  const getChatContext = () => {
    const { solarTermId, provinceCode, caseId } = current.current.selection;
    return { solarTermId, provinceCode, caseId };
  };
  function invalidateMapRevision() { publish({ ...current.current, revision: current.current.revision + 1 }); }
  async function applyAiMapActions(actions: MapAction[], expectedRevision: number, signal: AbortSignal) {
    if (current.current.revision !== expectedRevision) throw new Error("地图选择已变化，未应用之前的地图操作。请重新提问。");
    const snapshot = current.current;
    const result = await prepareChatMapActions(selectionMapState(snapshot.selection, snapshot.highlightedProvinceCodes), actions, signal);
    signal.throwIfAborted();
    if (current.current.revision !== expectedRevision) throw new Error("地图选择已变化，未应用之前的地图操作。请重新提问。");
    dispatch({ type: "applyMap", value: result });
  }
  const selected = selection.provinceCode;
  function setSelected(id: string | null) {
    if (id === null) dispatch({ type: "province", value: null });
    else {
      const parsed = ProvinceCodeSchema.safeParse(id);
      if (parsed.success) dispatch({ type: "province", value: parsed.data });
    }
  }
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const { resource: matchingCases, retry: retryMatchingCases } = useProvinceCases(selection.solarTermId);
  return <ProvinceContext.Provider value={{ provinces, selection, visitOrigin, dispatch, revision, getMapRevision, getChatContext, invalidateMapRevision, highlightedProvinceCodes, applyAiMapActions, selected, raised: hovered ?? focused ?? selected, matchingCases, retryMatchingCases, setSelected, setHovered, setFocused }}>{children}</ProvinceContext.Provider>;
}

export function ProvinceLayers() {
  const { provinces, selected, raised, matchingCases, highlightedProvinceCodes, setSelected, setHovered, setFocused } = useProvinces();
  const counts: ReadonlyMap<string, number> | null = matchingCases.status === "success" ? matchingCases.counts : null;
  const countFor = (id: string) => counts?.get(id) ?? 0;
  const isRaised = (id: string) => matchingCases.status === "success" ? countFor(id) > 0 : id === raised;
  const order = (id: string) => Number(isRaised(id)) + Number(isRaised(id) && id === raised);
  // Only visual groups change stacking order. Hit regions and keyboard focus stay
  // in place, so lifting a province cannot move its pointer target away.
  const ordered = [...provinces].sort((a, b) => order(a.id) - order(b.id));
  const pathFor = (id: string) => `${MAP_GEOMETRY_URL}#shape-${id}`;
  return <g className="province-layers" data-match-status={matchingCases.status} aria-busy={matchingCases.status === "loading"}>
    <g className="province-art" pointerEvents="none" aria-hidden="true">
      {ordered.map(province => <g key={province.id} className="province-visual" data-visual-province={province.id} data-raised={isRaised(province.id)} data-matched={countFor(province.id) > 0} data-selected={province.id === selected} data-ai-highlighted={highlightedProvinceCodes.includes(province.id as ProvinceCode)}>
        <g className="province-paper">
          <use className="province-thickness" href={pathFor(province.id)} transform="translate(0 5)" />
          <use className="culture-map-province" href={pathFor(province.id)} />
          <use className="province-tint" href={pathFor(province.id)} />
        </g>
        {province.scenery && <>
          <clipPath id={`province-scenery-${province.id}`}><use href={pathFor(province.id)} clipRule="evenodd" /></clipPath>
          <g clipPath={`url(#province-scenery-${province.id})`}><PaperLandscape {...province.scenery} /></g>
        </>}
      </g>)}
      {/* Labels have their own top layer, so a neighbouring province's paper
          never covers a municipality label that was moved outside its border. */}
      {ordered.map(province => <g key={province.id} className="province-visual culture-map-labels" data-raised={isRaised(province.id)}>
          {(province.anchor[0] !== province.label[0] || province.anchor[1] !== province.label[1]) && <path className="culture-map-leader" d={`M${province.anchor[0]},${province.anchor[1]}L${province.label[0]},${province.label[1]}`} />}
          <text x={province.label[0]} y={province.label[1]} textAnchor="middle" dominantBaseline="central">{province.shortName}</text>
      </g>)}
    </g>
    <g className="province-targets">
      {provinces.map(province => <g key={province.id} role="button" tabIndex={0} aria-label={`选择${province.name}${matchingCases.status === "success" ? countFor(province.id) > 0 ? `，当前节气已收录${countFor(province.id)}则案例` : "，当前节气暂无已收录案例" : ""}`} aria-pressed={province.id === selected} className="province-target" data-province-code={province.id}
        onPointerEnter={event => { if (event.pointerType !== "touch") setHovered(province.id); }}
        onPointerLeave={() => setHovered(null)} onPointerCancel={() => setHovered(null)}
        onFocus={() => { setFocused(province.id); setHovered(null); }} onBlur={() => setFocused(null)}
        onClick={() => setSelected(province.id)}
        onKeyDown={event => {
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(province.id); }
          if (event.key === "Escape") { event.preventDefault(); setSelected(null); setHovered(null); }
        }}>
        <use href={pathFor(province.id)} />
        {province.anchor[0] !== province.label[0] || province.anchor[1] !== province.label[1] ? <rect x={province.label[0] - 16} y={province.label[1] - 10} width="32" height="20" rx="6" /> : null}
      </g>)}
    </g>
  </g>;
}

export function ProvinceControls() {
  const { provinces, selected, selection, visitOrigin, highlightedProvinceCodes, setSelected, setHovered, setFocused } = useProvinces();
  const inputId = useId();
  return <div className="province-controls">
    <div className="province-selection-row">
      <label htmlFor={inputId}>地区</label>
      <select id={inputId} value={selected ?? ""} onChange={event => { setSelected(event.target.value || null); setHovered(null); setFocused(null); }}>
        <option value="">全国</option>
        {provinces.map(province => <option key={province.id} value={province.id}>{province.name}</option>)}
      </select>
      <a className="province-case-link" href="#cultural-case-explorer">查看案例 </a>
    </div>
    {highlightedProvinceCodes.length > 0 && <p className="province-ai-highlight-note" role="status">AI 已标记：{highlightedProvinceCodes.map(code => provinces.find(province => province.id === code)?.shortName).join("、")}</p>}
    <div className="province-visit-links">
      {visitOrigin && <Link className="province-case-link" prefetch={false} href={visitHref(visitOrigin)}>返回节气探访</Link>}
      {(!visitOrigin || selection.solarTermId !== visitOrigin.solarTermId || selection.provinceCode !== visitOrigin.provinceCode) &&
        <Link className="province-case-link" prefetch={false} href={visitHref(selection)}>用当前筛选去探访</Link>}
    </div>
    {provinces.some(province => province.scenery) && <p className="province-scenery-note">纸雕山水为装饰意象，不代表真实地形。</p>}
  </div>;
}
