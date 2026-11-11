"use client";

import { useState, type ReactNode } from "react";
import { ExploreMotionControl } from "../ExploreMotion";
import { useProvinces } from "./ProvinceInteraction";

export default function MapViewport({ children }: { children: ReactNode }) {
  const [enlarged, setEnlarged] = useState(false);
  const { matchingCases, retryMatchingCases } = useProvinces();
  const message = matchingCases.status === "idle" ? "" : matchingCases.status === "loading" ? "正在匹配地区…" : matchingCases.status === "error" ? matchingCases.message : matchingCases.counts.size > 0 ? `${matchingCases.counts.size} 个地区有案例` : "该节气暂无地区案例";
  return <>
    <div className="culture-map-toolbar">
      <div className="province-match-feedback" data-status={matchingCases.status}><p role="status">{message}</p>{matchingCases.status === "error" && <button type="button" onClick={retryMatchingCases}>重新查找</button>}</div>
      <div className="culture-map-tools"><ExploreMotionControl /><button type="button" aria-pressed={enlarged} aria-label={enlarged ? "还原地图" : "放大地图"} onClick={() => setEnlarged(!enlarged)}>{enlarged ? "还原" : "放大"}<span aria-hidden="true">{enlarged ? "−" : "+"}</span></button></div>
    </div>
    <div className="culture-map-viewport" data-enlarged={enlarged} tabIndex={enlarged ? 0 : -1} role="region" aria-label={enlarged ? "放大地图，可横向和纵向滚动" : "地图视图"}>
      <div className="culture-map-canvas">{children}</div>
    </div>
  </>;
}
