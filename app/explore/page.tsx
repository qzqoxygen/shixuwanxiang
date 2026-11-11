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
          <span className="explore-title-phrase" aria-hidden="true">循四时，</span>
          <span className="explore-title-phrase" aria-hidden="true">
            访山河
            <svg className="explore-title-flourish" viewBox="0 0 190 18" preserveAspectRatio="none" focusable="false">
              <path fill="currentColor" d="M2 14c27-9 52-8 80-7 41 2 72 0 107-7-29 10-64 13-107 11C47 9 20 11 2 14Z" />
              <path fill="none" stroke="currentColor" strokeWidth=".65" d="M71 15c41 3 74-2 104-8" />
            </svg>
          </span>
        </h1>
        <p className="intro-description">按节气或地区查找地方故事。</p>
      </div>
      <span className="explore-intro-seal" aria-hidden="true">知时</span>
    </div>
    <div className="explore-map-layout"><ChinaProvinceMap /></div>
    <FloatingChat />
  </ExploreMotion>;
}
