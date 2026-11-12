"use client";

import { createContext, useContext, useId, useReducer, useState, type ReactNode } from "react";
import { ProvinceCodeSchema } from "@/lib/contracts/cultural-case";
import { exploreSelectionReducer, INITIAL_EXPLORE_SELECTION, type ExploreSelection, type ExploreSelectionAction } from "@/lib/explore-selection";
import PaperLandscape from "./PaperLandscape";
import { useProvinceCases, type ProvinceCases } from "./useProvinceCases";

export type ProvinceView = {
  id: string;
  name: string;
  shortName: string;
  path: string;
  anchor: readonly [number, number];
  label: readonly [number, number];
  scenery?: { x: number; y: number; scale: number };
};

type Interaction = {
  selection: ExploreSelection;
  dispatch: (action: ExploreSelectionAction) => void;
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

export function ProvinceInteraction({ provinces, children, initialSelection = INITIAL_EXPLORE_SELECTION }: { provinces: ProvinceView[]; children: ReactNode; initialSelection?: ExploreSelection }) {
  const [selection, dispatch] = useReducer(exploreSelectionReducer, initialSelection);
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
  return <ProvinceContext.Provider value={{ provinces, selection, dispatch, selected, raised: hovered ?? focused ?? selected, matchingCases, retryMatchingCases, setSelected, setHovered, setFocused }}>{children}</ProvinceContext.Provider>;
}

export function ProvinceLayers() {
  const { provinces, selected, raised, matchingCases, setSelected, setHovered, setFocused } = useProvinces();
  const counts: ReadonlyMap<string, number> | null = matchingCases.status === "success" ? matchingCases.counts : null;
  const countFor = (id: string) => counts?.get(id) ?? 0;
  const isRaised = (id: string) => matchingCases.status === "success" ? countFor(id) > 0 : id === raised;
  const order = (id: string) => Number(isRaised(id)) + Number(isRaised(id) && id === raised);
  // Only visual groups change stacking order. Hit regions and keyboard focus stay
  // in place, so lifting a province cannot move its pointer target away.
  const ordered = [...provinces].sort((a, b) => order(a.id) - order(b.id));
  return <g className="province-layers" data-match-status={matchingCases.status} aria-busy={matchingCases.status === "loading"}>
    <g className="province-art" pointerEvents="none" aria-hidden="true">
      {ordered.map(province => <g key={province.id} className="province-visual" data-visual-province={province.id} data-raised={isRaised(province.id)} data-matched={countFor(province.id) > 0} data-selected={province.id === selected}>
        <g className="province-paper">
          <path className="province-thickness" d={province.path} fillRule="evenodd" transform="translate(0 5)" />
          <path className="culture-map-province" d={province.path} fillRule="evenodd" vectorEffect="non-scaling-stroke" />
          <path className="province-tint" d={province.path} fillRule="evenodd" />
        </g>
        {province.scenery && <>
          <clipPath id={`province-scenery-${province.id}`}><path d={province.path} fillRule="evenodd" /></clipPath>
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
        <path d={province.path} fillRule="evenodd" />
        {province.anchor[0] !== province.label[0] || province.anchor[1] !== province.label[1] ? <rect x={province.label[0] - 16} y={province.label[1] - 10} width="32" height="20" rx="6" /> : null}
      </g>)}
    </g>
  </g>;
}

export function ProvinceControls() {
  const { provinces, selected, setSelected, setHovered, setFocused } = useProvinces();
  const inputId = useId();
  return <div className="province-controls">
    <div className="province-selection-row">
      <label htmlFor={inputId}>地区</label>
      <select id={inputId} value={selected ?? ""} onChange={event => { setSelected(event.target.value || null); setHovered(null); setFocused(null); }}>
        <option value="">全国</option>
        {provinces.map(province => <option key={province.id} value={province.id}>{province.name}</option>)}
      </select>
      <a className="province-case-link" href="#cultural-case-explorer">查看案例 <span aria-hidden="true">↓</span></a>
    </div>
    {provinces.some(province => province.scenery) && <p className="province-scenery-note">纸雕山水为装饰意象，不代表真实地形。</p>}
  </div>;
}
