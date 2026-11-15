import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site-name";
import { readCulturalCases } from "@/lib/server/cultural-cases";
import { editorialPhotoCredits } from "../home/editorial-photos";

export const metadata: Metadata = {
  title: "关于",
  description: "了解时序万象的二十四节气文化案例、DeepSeek 应用、资料来源和参赛团队。",
};

export default function AboutPage() {
  const cases = readCulturalCases().filter(item => item.verificationStatus === "verified");
  const coveredTerms = new Set(cases.flatMap(item => item.solarTermIds)).size;
  const coveredRegions = new Set(cases.flatMap(({ provinceCode, relatedProvinceCodes = [] }) => [
    provinceCode, ...relatedProvinceCodes,
  ])).size;

  return <>
    <div className="intro">
      <p className="eyebrow">关于 · {SITE_NAME}</p>
      <h1>观四时，知文化。</h1>
      <p className="intro-description">读懂节气，探访地方风物，把有出处的故事做成一张节气卡。</p>
    </div>
    <div className="about-grid">
      <section className="paper-card prose">
        <h2>我们在做什么</h2>
        <p>{SITE_NAME} 是一个二十四节气文化探索与创作平台。你可以在「四时」翻阅风物册，在「知时」用地图比较各地习俗，也可以从「节气探访」查到一则地方故事，带到「造物」制成节气卡。</p>
        <p>本站收录 {cases.length} 则已核验文化案例，覆盖 {coveredTerms} 个节气和 {coveredRegions} 个省级地区。</p>
        <Link className="text-link" href="/visit" prefetch={false}>开始节气探访</Link>
      </section>
      <section className="paper-card prose">
        <h2>AI 怎样帮助你探索</h2>
        <p>在「四时」，DeepSeek 按当前节气补充导读。在「知时」，它可调用工具查询案例、比较地区，并给出可确认的地图操作。</p>
        <p>「节气探访」优先查找本站案例，资料不足时尝试联网补查。「造物」可根据节气或案例生成标题和短句，供你挑选、编辑并导出作品。</p>
        <Link className="text-link" href="/explore" prefetch={false}>去知时比较地方习俗</Link>
      </section>
      <section className="paper-card prose">
        <h2>二十四节气与非遗</h2>
        <p>二十四节气是中国人通过观察太阳周年运动形成的时间知识体系及其实践，体现了人与自然相处的经验。</p>
        <p>2016 年，二十四节气列入联合国教科文组织人类非物质文化遗产代表作名录。</p>
        <a className="text-link" href="https://ich.unesco.org/en/RL/00647" target="_blank" rel="noopener noreferrer">阅读 UNESCO 官方介绍</a>
      </section>
      <section className="paper-card prose">
        <h2>资料来源与核验</h2>
        <p>节气顺序与太阳黄经参考香港天文台。每则已核验案例记录所在地区、关联节气及原文出处。</p>
        <p>探访结果会标明本站案例、联网记录或相关线索。阅读 AI 解读时，可以打开随附出处核对细节。</p>
        <a className="text-link" href="https://www.hko.gov.hk/tc/gts/time/24solarterms.htm" target="_blank" rel="noopener noreferrer">查看香港天文台资料</a>
      </section>
      <section className="paper-card prose">
        <h2>参赛团队</h2>
        <p><strong>QSX</strong> · 曲阜师范大学</p>
        <p>队员为邱紫琦、许展硕、商艺蕊。</p>
        <p>2026 第九届传智杯全国大学生数智创新与 AI 应用大赛 · AI WEB 网页开发挑战赛（团队赛，B 组）</p>
      </section>
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
      </section>
    </div>
  </>;
}
