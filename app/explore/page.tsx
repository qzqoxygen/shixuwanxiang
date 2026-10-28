import type { Metadata } from "next";
import ChatPanel from "@/components/ChatPanel";
export const metadata: Metadata = { title: "知时" };
export default function ExplorePage() {
  return <><div className="intro"><p className="eyebrow">知时 · 问文化</p><h1>一问一答，走近传统。</h1><p className="intro-description">与 AI 文化讲解员交流节气知识，辨别共通的时间规律与各地不同的文化实践。</p></div>
    <div className="explore-grid"><ChatPanel /><section className="paper-card map-placeholder" aria-labelledby="map-title">
      <span className="status-label">开发中</span><div className="placeholder-mark" aria-hidden="true">知</div><h2 id="map-title">文化地图开发中</h2><p>未来将从地域出发，关联节气文化案例与传统技艺。</p><p className="muted">当前尚未接入地图或地区数据。你可以先在左侧提问，了解感兴趣的节气与文化主题。</p>
    </section></div></>;
}
