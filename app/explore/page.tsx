import type { Metadata } from "next";
import ChatPanel from "@/components/ChatPanel";
import ChinaProvinceMap from "@/components/cultural-map/ChinaProvinceMap";
import "./explore.css";
export const metadata: Metadata = { title: "知时" };
export default function ExplorePage() {
  return <div className="explore-page">
    <div className="intro explore-intro">
      <div className="explore-title"><p className="eyebrow"><span aria-hidden="true">卷一</span> 知时 · 山河四时</p><h1>循四时，访山河。</h1><p className="intro-description">展一卷山河，读一方风物。在节气与山水之间，寻访中国的日常。</p></div>
      <div className="explore-inscription" aria-hidden="true"><span>山河有意</span><span>四时有序</span><i>知时</i></div>
    </div>
    <div className="explore-grid"><ChatPanel /><ChinaProvinceMap /></div>
  </div>;
}
