import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site-name";
import { readCulturalCases } from "@/lib/server/cultural-cases";
import { editorialPhotoCredits } from "../home/editorial-photos";
export const metadata: Metadata = { title: "关于" };
export default function AboutPage() {
  const cases = readCulturalCases().filter(item => item.verificationStatus === "verified");
  const coveredTerms = new Set(cases.flatMap(item => item.solarTermIds)).size;
  return <><div className="intro"><p className="eyebrow">关于 · {SITE_NAME}</p><h1>观四时，知文化。</h1><p className="intro-description">以节气为入口，探索时间知识、文化实践与数字表达之间的联系。</p></div>
    <div className="about-grid"><section className="paper-card prose"><h2>我们在做什么</h2><p>{SITE_NAME} 是一个基于多模态智能体的二十四节气非遗文化可视化探索与交互创作平台。</p><p>当前开放二十四节气资料、地域文化案例与中国省级地图联动、DeepSeek AI 文化问答，以及节气卡创意工坊。</p><p>已收录 {cases.length} 则已核实文化案例，覆盖 {coveredTerms} 个节气。选择节气或地区，即可查看地方故事及资料来源。</p></section>
    <section className="paper-card prose"><h2>二十四节气与非遗</h2><p>二十四节气是中国人通过观察太阳周年运动形成的时间知识体系及其实践，体现了人与自然相处的经验。</p><p>2016 年，二十四节气列入联合国教科文组织人类非物质文化遗产代表作名录。</p><a className="text-link" href="https://ich.unesco.org/en/RL/00647" target="_blank" rel="noopener noreferrer">阅读 UNESCO 官方介绍</a></section>
    <section className="paper-card prose"><h2>当前资料来源</h2><p>节气顺序与太阳黄经参考香港天文台的二十四节气说明。基础描述为简要整理，不将传统季节划分等同于各地实际天气。</p><a className="text-link" href="https://www.hko.gov.hk/tc/gts/time/24solarterms.htm" target="_blank" rel="noopener noreferrer">查看香港天文台资料</a><p>AI 文化问答可参考本站已核实案例，需要实时信息时再检索互联网，并展示实际检索到的来源。未能核实的信息会明确说明；模型生成的回答仍需结合原文判断。</p></section>
    <section className="paper-card prose"><h2>如何管理资料</h2><p>文化案例统一记录节气、地区、介绍、节气关联依据与原文来源。补采资料经过比对后持续增补，整理状态和必要备注保留在数据审核记录中。</p><p>尚未核实的地域民俗不作为已确认资料展示；未明确授权的素材不作为可自由创作资源。当前没有对外宣称文化机构合作或素材授权。</p></section>
    <section className="paper-card prose" id="home-photo-sources">
      <h2>首页影像鸣谢</h2>
      <p>照片经缩放、裁切或局部抠图。带链接的条目可查看原图与拍摄信息。</p>
      <ul>
        {editorialPhotoCredits.map(({ src, caption, credit, sourceUrl, license, licenseUrl }) => (
          <li key={src}>
            {sourceUrl ? <a className="text-link" href={sourceUrl} target="_blank" rel="noreferrer">{caption}</a> : caption} · {credit}
            {licenseUrl && <> · <a className="text-link" href={licenseUrl} target="_blank" rel="noreferrer">{license}</a></>}
          </li>
        ))}
      </ul>
    </section></div></>;
}
