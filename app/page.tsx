import Link from "next/link";
const spaces = [
  { href: "/seasons", number: "壹", title: "四时", subtitle: "探索二十四节气", description: "循着太阳的周年运行，认识四季中的二十四个时间节点。", note: "节气基础资料已开放", tone: "spring" },
  { href: "/explore", number: "贰", title: "知时", subtitle: "探索地域文化与传统技艺", description: "从一个问题开始，与 AI 文化讲解员聊聊节气与生活。", note: "AI 问答 · 基础地图已开放", tone: "summer" },
  { href: "/studio", number: "叁", title: "造物", subtitle: "做一张自己的节气卡", description: "挑选节气和版式，写下短句，贴上四时风物，把作品保存成图片。", note: "进入节气卡工坊", tone: "autumn" },
];
export default function Home() {
  return <>
    <section className="hero">
      <div><p className="eyebrow">四时有序 · 万象有生</p><h1>时序万象<span>·AI</span></h1>
      <p className="hero-subtitle">基于多模态智能体的二十四节气非遗文化可视化探索与交互创作平台</p>
      <p className="muted">从四时的更迭走近文化，在问答中认识传统，再把自己的节气记忆做成一张卡片。</p>
      <Link className="ink-link" href="/seasons">从四时开始 <span aria-hidden="true">↗</span></Link></div>
      <div className="season-seal" aria-hidden="true"><span>春</span><span>夏</span><span>秋</span><span>冬</span><i>四时</i></div>
    </section>
    <section aria-labelledby="spaces-title"><div className="section-heading"><h2 id="spaces-title">循时而入</h2><p>三个空间，一段文化探索之旅</p></div>
      <div className="space-grid">{spaces.map((space) => <Link href={space.href} className={`space-card tone-${space.tone}`} key={space.href}>
        <span className="space-number">{space.number}</span><h3>{space.title}</h3><p className="card-subtitle">{space.subtitle}</p><p className="muted">{space.description}</p><div className="card-bottom"><small>{space.note}</small><span aria-hidden="true">↗</span></div>
      </Link>)}</div>
    </section>
    <p className="page-note">本期重点：清明、夏至、秋分、冬至。现已提供全部二十四节气的基础资料。</p>
  </>;
}
