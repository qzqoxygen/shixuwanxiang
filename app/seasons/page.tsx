import type { Metadata } from "next";
import SolarTermsExplorer from "@/components/SolarTermsExplorer";
export const metadata: Metadata = { title: "四时" };
export default function SeasonsPage() {
  return <><div className="intro"><p className="eyebrow">四时 · 循序识节气</p><h1>一岁四时，二十四节。</h1><p className="intro-description">点击任一节气查看基础信息。本期重点探索清明、夏至、秋分、冬至。</p></div><SolarTermsExplorer />
    <p className="page-note">节气顺序与太阳黄经参考<a className="text-link" href="https://www.hko.gov.hk/tc/gts/time/24solarterms.htm" target="_blank" rel="noopener noreferrer">香港天文台</a>。四季分组沿用传统历法，不等同于各地实际气候。</p></>;
}
