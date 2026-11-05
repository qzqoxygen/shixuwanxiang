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
      <div className="explore-title"><h1>循四时，访山河。</h1><p className="intro-description">从一个节气出发，在中国地图上寻访一方风物。</p></div>
      <div className="explore-inscription" aria-hidden="true"><span>山河有意</span><span>四时有序</span><i>知时</i></div>
    </div>
    <div className="explore-map-layout"><ChinaProvinceMap /></div>
    <FloatingChat />
  </ExploreMotion>;
}
