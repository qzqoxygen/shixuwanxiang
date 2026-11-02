"use client";

import { useState, type ReactNode } from "react";

export default function MapViewport({ children }: { children: ReactNode }) {
  const [enlarged, setEnlarged] = useState(false);
  return <>
    <div className="culture-map-toolbar">
      <span>{enlarged ? "滑动查看地图各处" : "省界与地名一览"}</span>
      <button type="button" aria-pressed={enlarged} onClick={() => setEnlarged(!enlarged)}>{enlarged ? "适应宽度" : "放大查看"}<span aria-hidden="true">{enlarged ? "−" : "+"}</span></button>
    </div>
    <div className="culture-map-viewport" data-enlarged={enlarged} tabIndex={enlarged ? 0 : -1} role="region" aria-label={enlarged ? "放大地图，可横向和纵向滚动" : "地图视图"}>
      <div className="culture-map-canvas">{children}</div>
    </div>
  </>;
}
