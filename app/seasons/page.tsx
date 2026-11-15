import type { Metadata } from "next";
import { Suspense } from "react";
import InkLandscape from "@/components/InkLandscape";
import SolarTermsExplorer from "@/components/SolarTermsExplorer";
import { getSeasonGuide, type GuideCaseSources } from "@/lib/season-guides";
import { SOLAR_TERMS } from "@/lib/solar-terms";
import { studioCaseForTerm } from "@/lib/server/cultural-case-context";
import { SolarTermIdSchema } from "@/lib/contracts/cultural-case";
import { readVisitOrigin } from "@/lib/visit-links";
import "./seasons.css";
import "./book.css";
import "./reading-room.css";
import "./mobile.css";
import "./finishing.css";
import "./vignette.css";
import "./guide.css";
export const metadata: Metadata = { title: "四时" };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function SelectedBook({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { data: term } = SolarTermIdSchema.safeParse(params.solarTermId);
  const origin = readVisitOrigin(params);
  const caseSources: GuideCaseSources = {};
  for (const { id } of SOLAR_TERMS) {
    const item = studioCaseForTerm(getSeasonGuide(id).caseId, id);
    if (item) caseSources[id] = { title: item.title, url: item.sources[0].url };
  }
  return <SolarTermsExplorer key={term} caseSources={caseSources} initialTerm={term} visitOrigin={origin} />;
}

export default function SeasonsPage({ searchParams }: { searchParams: SearchParams }) {
  return <div className="seasons-page seasons-reading-room">
    <InkLandscape />
    <h1 className="seasons-sr-only">四时：二十四节气风物册</h1>
    <Suspense fallback={<p className="muted" role="status">正在翻开四时风物册…</p>}>
      <SelectedBook searchParams={searchParams} />
    </Suspense>
    <aside className="seasons-source">
      <span className="seasons-source-mark" aria-hidden="true">记</span>
      <p>
        太阳在黄道上的视位置每推进 15°，便迎来一个新的节气。节气顺序与太阳黄经参考<a className="text-link" href="https://www.hko.gov.hk/tc/gts/time/24solarterms.htm" target="_blank" rel="noopener noreferrer">香港天文台<span className="seasons-sr-only">（新窗口打开）</span></a>。四季分组沿用传统历法，不等同于各地实际气候。
        <br />
        照片为与节气意象相关的自然与生活影像，摄影署名、图片来源和许可见照片卡；节气文化延伸阅读来自<a className="text-link" href="https://www.ihchina.cn/solar_terms.html" target="_blank" rel="noopener noreferrer">中国非遗网<span className="seasons-sr-only">（新窗口打开）</span></a>。
      </p>
    </aside>
  </div>;
}
