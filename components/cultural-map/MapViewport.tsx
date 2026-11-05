"use client";

import { useState, type ReactNode } from "react";
import { ExploreMotionControl } from "../ExploreMotion";
import { useProvinces } from "./ProvinceInteraction";

export default function MapViewport({ children }: { children: ReactNode }) {
  const [enlarged, setEnlarged] = useState(false);
  const { selection, provinces, matchingCases, retryMatchingCases } = useProvinces();
  const province = provinces.find(item => item.id === selection.provinceCode)?.name ?? "全国";
  const message = matchingCases.status === "idle" ? "选择节气后，已收录相关案例的省份会自动浮起。" : matchingCases.status === "loading" ? "正在查找有对应案例的省份…" : matchingCases.status === "error" ? matchingCases.message : matchingCases.counts.size > 0 ? `已找到 ${matchingCases.counts.size} 个有案例的省份，点击浮起的板块查看案例。` : "这个节气暂未收录已核实的地区案例，可以换个节气继续探索。";
  return <>
    <div className="culture-map-toolbar">
      <div className="culture-map-context"><span>{enlarged ? "滑动查看各处" : "正在浏览"}</span><strong>{province}</strong></div>
      <div className="culture-map-tools"><ExploreMotionControl /><button type="button" aria-pressed={enlarged} onClick={() => setEnlarged(!enlarged)}>{enlarged ? "适应宽度" : "放大查看"}<span aria-hidden="true">{enlarged ? "−" : "+"}</span></button></div>
    </div>
    <div className="province-match-feedback" data-status={matchingCases.status}><p role="status">{message}</p>{matchingCases.status === "error" && <button type="button" onClick={retryMatchingCases}>重新查找</button>}</div>
    <div className="culture-map-viewport" data-enlarged={enlarged} tabIndex={enlarged ? 0 : -1} role="region" aria-label={enlarged ? "放大地图，可横向和纵向滚动" : "地图视图"}>
      <div className="culture-map-canvas">{children}</div>
    </div>
  </>;
}
