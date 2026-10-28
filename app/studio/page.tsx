import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "造物" };
const plans = [["节气主题选择", "以四时为线索，构思作品主题。"], ["AI 创意方案", "围绕文化主题梳理创作方向。"], ["传统文化素材", "整理来源清晰、授权明确的素材。"], ["可编辑数字作品", "将创意组织成可调整的数字表达。"], ["图片导出", "保存与分享完成的作品。"]];
export default function StudioPage() {
  return <><div className="intro"><p className="eyebrow">造物 · 以文化为灵感</p><h1>让传统，生出新的表达。</h1><p className="intro-description">数字创意工坊正在规划中。以下是未来方向，当前尚未开放创作与导出功能。</p></div>
    <section className="paper-card studio-intro"><span className="status-label">创意工坊开发中</span><h2>从一枚节气，走向一件作品</h2><p>先理解文化，再开展创作。当前可以浏览节气基础资料，或与 AI 文化讲解员交流。</p><Link className="ink-link" href="/seasons">浏览节气资料 ↗</Link></section>
    <ol className="plan-grid">{plans.map(([title, description], index) => <li className="paper-card" key={title}><span className="plan-number">0{index + 1}</span><h2>{title}</h2><p className="muted">{description}</p><span className="status-label">开发中</span></li>)}</ol></>;
}
