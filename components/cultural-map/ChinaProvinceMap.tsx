import mapData from "@/data/maps/china-provinces.geo.json";
import { createMapProjection, geometryToPath, type MapPoint, type ProvinceFeature } from "@/lib/map-projection";
import "./ChinaProvinceMap.css";
import MapViewport from "./MapViewport";
import { ProvinceControls, ProvinceInteraction, ProvinceLayers, type ProvinceView } from "./ProvinceInteraction";
import CulturalCaseExplorer, { SolarTermFilter } from "./CulturalCaseExplorer";

const features = mapData.features as unknown as ProvinceFeature[];
const provinces = features.filter((feature) => /^\d{6}$/.test(String(feature.properties.adcode)));
const mainProject = createMapProjection([73, 17, 136, 54], [-22, 10, 840, 510]);
const insetProject = createMapProjection([105, 2, 125, 25], [700, 376, 110, 150]);

// Move only crowded labels, never province boundaries. Leaders keep the
// municipality labels connected to their actual geographic positions.
const labelOffsets: Record<string, MapPoint> = {
  "110000": [-10, -19],
  "120000": [30, -4],
  "310000": [30, 2],
  "130000": [8, -4],
  "140000": [-4, 0],
  "320000": [9, 0],
  "340000": [-4, 0],
  "460000": [-12, 8],
  "810000": [25, 22],
  "820000": [7, 46],
};

function provinceName(name: string) {
  return name.replace(/维吾尔自治区|壮族自治区|回族自治区|特别行政区|自治区|省|市/g, "");
}

// Keep the source GeoJSON and projection work on the server. The interactive
// island receives only the paths and labels that it needs to display.
const provinceViews: ProvinceView[] = provinces.map(({ properties, geometry }) => {
  const anchor = mainProject(properties.centroid ?? properties.center!);
  const [dx, dy] = labelOffsets[String(properties.adcode)] ?? [0, 0];
  const id = String(properties.adcode);
  return { id, name: properties.name!, shortName: provinceName(properties.name!), path: geometryToPath(geometry, mainProject), anchor, label: [anchor[0] + dx, anchor[1] + dy] };
});

export default function ChinaProvinceMap() {
  return (
    <section className="culture-map-panel" aria-labelledby="culture-map-heading">
      <ProvinceInteraction provinces={provinceViews}>
        <div className="culture-map-spread">
          <div className="culture-map-sheet">
            <header className="culture-map-header">
              <h2 id="culture-map-heading">山河风物志</h2>
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
                    {features.filter(feature => !feature.properties.name).map(feature => <path key={feature.properties.adcode} className="culture-map-maritime" d={geometryToPath(feature.geometry, mainProject)} fillRule="evenodd" vectorEffect="non-scaling-stroke" />)}
                    <ProvinceLayers />
                  </g>

                  <g aria-hidden="true">
                    <rect className="culture-map-insetBackground" x="693" y="369" width="124" height="181" rx="3" />
                    <g clipPath="url(#china-sea-clip)" className="culture-map-boundaries">
                      {features.map((feature) => (
                        <path key={feature.properties.adcode} className={feature.properties.name ? "culture-map-province" : "culture-map-maritime"} d={geometryToPath(feature.geometry, insetProject)} fillRule="evenodd" vectorEffect="non-scaling-stroke" />
                      ))}
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
      </ProvinceInteraction>
    </section>
  );
}
