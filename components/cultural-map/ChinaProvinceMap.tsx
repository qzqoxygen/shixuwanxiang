import provinceLabels from "@/data/maps/province-labels.json";
import { MAP_GEOMETRY_URL } from "@/lib/map-assets";
import "./ChinaProvinceMap.css";
import MapViewport from "./MapViewport";
import { ProvinceControls, ProvinceInteraction, ProvinceLayers, type ProvinceView } from "./ProvinceInteraction";
import CulturalCaseExplorer, { SolarTermFilter } from "./CulturalCaseExplorer";
import { INITIAL_EXPLORE_SELECTION, type ExploreSelection } from "@/lib/explore-selection";
import type { VisitQuery } from "@/lib/solar-visit";
import { visitHref } from "@/lib/visit-links";
import FloatingChat from "../FloatingChat";

// Carry just the labels through the interactive component boundary. The SVG
// layers share the preprojected paths from a same-origin static asset.
const provinceViews: ProvinceView[] = provinceLabels.map(({ anchor, label, ...province }) => ({
  ...province,
  anchor: [anchor[0], anchor[1]],
  label: [label[0], label[1]],
}));

export default function ChinaProvinceMap({ initialSelection = INITIAL_EXPLORE_SELECTION, visitOrigin }: {
  initialSelection?: ExploreSelection; visitOrigin?: VisitQuery;
}) {
  return (
    <section className="culture-map-panel" aria-labelledby="culture-map-heading">
      <ProvinceInteraction key={`${initialSelection.solarTermId}-${initialSelection.provinceCode}-${initialSelection.caseId}-${visitHref(visitOrigin)}`}
        provinces={provinceViews} initialSelection={initialSelection} visitOrigin={visitOrigin}>
        <div className="culture-map-spread">
          <div className="culture-map-sheet">
            <header className="culture-map-header">
              <h2 id="culture-map-heading" tabIndex={-1}>山河风物志</h2>
            </header>

            <SolarTermFilter />
            <ProvinceControls />
            <figure className="culture-map-figure">
              <MapViewport>
                <svg className="culture-map-map" viewBox="0 0 840 560" role="group" aria-labelledby="china-map-title" aria-describedby="china-map-description">
                  <title id="china-map-title">中国省级行政区互动地图</title>
                  <desc id="china-map-description">显示34个省级行政区，包括台湾、香港、澳门；右下角为南海诸岛附图。鼠标移入可浮起预览，点击或按回车、空格可选定，Escape 取消选择。</desc>
                  <defs>
                    <linearGradient id="china-ink-wash" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#DDE8DC" stopOpacity=".32" />
                      <stop offset=".45" stopColor="#F8F6EF" stopOpacity=".12" />
                      <stop offset="1" stopColor="#A5C9C2" stopOpacity=".25" />
                    </linearGradient>
                    <pattern id="china-xuan-paper" patternUnits="userSpaceOnUse" width="840" height="560">
                      <rect width="840" height="560" fill="#f8f6ef" />
                      <image href="/images/xuan-paper.webp" width="840" height="560" preserveAspectRatio="xMidYMid slice" opacity=".12" />
                      <rect width="840" height="560" fill="url(#china-ink-wash)" />
                    </pattern>
                    <clipPath id="china-main-clip"><rect x="0" y="0" width="840" height="540" /></clipPath>
                    <clipPath id="china-sea-clip"><rect x="700" y="376" width="110" height="150" /></clipPath>
                  </defs>

                  <g className="culture-map-compass" aria-hidden="true" transform="translate(63 76)">
                    <text textAnchor="middle" y="-22">北</text>
                    <path d="M0 -12 L-5 8 L0 4 L5 8 Z" />
                    <path d="M0 4 V24" />
                  </g>

                  <g clipPath="url(#china-main-clip)" className="culture-map-boundaries">
                    <use className="culture-map-maritime" href={`${MAP_GEOMETRY_URL}#main-maritime`} />
                    <ProvinceLayers />
                  </g>

                  <g aria-hidden="true">
                    <rect className="culture-map-insetBackground" x="693" y="369" width="124" height="181" rx="3" />
                    <g clipPath="url(#china-sea-clip)" className="culture-map-boundaries">
                      <use className="culture-map-province" href={`${MAP_GEOMETRY_URL}#inset-provinces`} />
                      <use className="culture-map-maritime" href={`${MAP_GEOMETRY_URL}#inset-maritime`} />
                    </g>
                    <text className="culture-map-insetLabel" x="755" y="541" textAnchor="middle">南海诸岛</text>
                  </g>
                  <text className="culture-map-seaLabel" x="638" y="400" aria-hidden="true">东 海</text>
                </svg>
              </MapViewport>
              <figcaption className="culture-map-caption">
                底图 <a href="https://datav.aliyun.com/portal/school/atlas/atlas_aigc" target="_blank" rel="noreferrer">DataV.GeoAtlas</a>（高德开放平台）
              </figcaption>
            </figure>
          </div>
          <CulturalCaseExplorer />
        </div>
        <FloatingChat />
      </ProvinceInteraction>
    </section>
  );
}
