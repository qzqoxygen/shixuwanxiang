import type { Metadata } from "next";
export const metadata: Metadata = { title: "关于" };
export default function AboutPage() {
  return <><div className="intro"><p className="eyebrow">关于 · 时序万象</p><h1>观四时，知文化。</h1><p className="intro-description">以节气为入口，探索时间知识、文化实践与数字表达之间的联系。</p></div>
    <div className="about-grid"><section className="paper-card prose"><h2>我们在做什么</h2><p>时序万象·AI 定位于基于多模态智能体的二十四节气非遗文化可视化探索与交互创作平台。</p><p>当前开放二十四节气资料、DeepSeek AI 文化问答与中国省级基础地图浏览。地域文化案例、地图联动、传统技艺交互与数字创意工坊正在逐步建设。</p><p>清明、夏至、秋分、冬至是后续重点探索的四个节气。</p></section>
    <section className="paper-card prose"><h2>二十四节气与非遗</h2><p>二十四节气是中国人通过观察太阳周年运动形成的时间知识体系及其实践，体现了人与自然相处的经验。</p><p>2016 年，二十四节气列入联合国教科文组织人类非物质文化遗产代表作名录。</p><a className="text-link" href="https://ich.unesco.org/en/RL/00647" target="_blank" rel="noopener noreferrer">阅读 UNESCO 官方介绍 ↗</a></section>
    <section className="paper-card prose"><h2>当前资料来源</h2><p>节气顺序与太阳黄经参考香港天文台的二十四节气说明。基础描述为简要整理，不将传统季节划分等同于各地实际天气。</p><a className="text-link" href="https://www.hko.gov.hk/tc/gts/time/24solarterms.htm" target="_blank" rel="noopener noreferrer">查看香港天文台资料 ↗</a><p>AI 回答由模型生成，可能有误；当前未接入知识库或联网核验，请结合可靠资料判断。</p></section>
    <section className="paper-card prose"><h2>未来如何管理资料</h2><p>后续文化案例拟记录地区、出处、原文链接、整理日期与授权状态，并将知识说明与创作素材分别管理。</p><p>尚未核实的地域民俗不作为已确认资料展示；未明确授权的素材不作为可自由创作资源。当前没有对外宣称文化机构合作或素材授权。</p></section></div></>;
}
