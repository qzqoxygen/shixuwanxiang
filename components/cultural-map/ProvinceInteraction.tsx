"use client";

import { createContext, useContext, useId, useState, type ReactNode } from "react";
import PaperLandscape from "./PaperLandscape";

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
  provinces: ProvinceView[];
  selected: string | null;
  raised: string | null;
  setSelected: (id: string | null) => void;
  setHovered: (id: string | null) => void;
  setFocused: (id: string | null) => void;
};
const ProvinceContext = createContext<Interaction | null>(null);
function useProvinces() {
  const context = useContext(ProvinceContext);
  if (!context) throw new Error("Province controls require their map provider");
  return context;
}

export function ProvinceInteraction({ provinces, children }: { provinces: ProvinceView[]; children: ReactNode }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  return <ProvinceContext.Provider value={{ provinces, selected, raised: hovered ?? focused ?? selected, setSelected, setHovered, setFocused }}>{children}</ProvinceContext.Provider>;
}

export function ProvinceLayers() {
  const { provinces, selected, raised, setSelected, setHovered, setFocused } = useProvinces();
  // Only visual groups change stacking order. Hit regions and keyboard focus stay
  // in place, so lifting a province cannot move its pointer target away.
  const ordered = [...provinces].sort((a, b) => Number(a.id === raised) - Number(b.id === raised));
  return <g className="province-layers">
    <g className="province-art" pointerEvents="none" aria-hidden="true">
      {ordered.map(province => <g key={province.id} className="province-visual" data-visual-province={province.id} data-raised={province.id === raised} data-selected={province.id === selected}>
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
      {ordered.map(province => <g key={province.id} className="province-visual culture-map-labels" data-raised={province.id === raised}>
          {(province.anchor[0] !== province.label[0] || province.anchor[1] !== province.label[1]) && <path className="culture-map-leader" d={`M${province.anchor[0]},${province.anchor[1]}L${province.label[0]},${province.label[1]}`} />}
          <text x={province.label[0]} y={province.label[1]} textAnchor="middle" dominantBaseline="central">{province.shortName}</text>
      </g>)}
    </g>
    <g className="province-targets">
      {provinces.map(province => <g key={province.id} role="button" tabIndex={0} aria-label={`选择${province.name}`} aria-pressed={province.id === selected} className="province-target" data-province-code={province.id}
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
  const selectedProvince = provinces.find(province => province.id === selected);
  return <div className="province-controls">
    <div className="province-selection-row">
      <label htmlFor={inputId}>寻一方水土</label>
      <select id={inputId} value={selected ?? ""} onChange={event => { setSelected(event.target.value || null); setHovered(null); setFocused(null); }}>
        <option value="">选择省级行政区</option>
        {provinces.map(province => <option key={province.id} value={province.id}>{province.name}</option>)}
      </select>
      <button type="button" disabled={!selected} onClick={() => { setSelected(null); setHovered(null); setFocused(null); }}>取消选择</button>
    </div>
    <p className="province-selection-status" role="status">{selectedProvince ? `已选择：${selectedProvince.name}。文化案例正在整理中。` : "移入省份可预览浮起，点击可选定；也可通过列表或键盘选择。"}</p>
    {provinces.some(province => province.scenery) && <p className="province-scenery-note">纸雕山水为装饰意象，不代表真实地形。</p>}
  </div>;
}
