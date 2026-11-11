import type { Metadata } from "next";
import FloatingChat from "@/components/FloatingChat";
import ChinaProvinceMap from "@/components/cultural-map/ChinaProvinceMap";
import ExploreMotion from "@/components/ExploreMotion";
import "./explore.css";
import "./explore-motion.css";
export const metadata: Metadata = { title: "知时" };
export default function ExplorePage() {
  return <ExploreMotion>
    <div className="intro explore-intro">
      <div className="explore-title">
        <h1 aria-label="循四时，访山河">
          <span aria-hidden="true">循四时，</span>
          <span aria-hidden="true">访山河</span>
        </h1>
        <p className="intro-description">按节气或地区查找地方故事。</p>
      </div>
      <span className="explore-intro-seal" aria-hidden="true">知时</span>
    </div>
    <div className="explore-map-layout"><ChinaProvinceMap /></div>
    <FloatingChat />
  </ExploreMotion>;
}
