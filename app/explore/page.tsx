import type { Metadata } from "next";
import { Suspense } from "react";
import ChinaProvinceMap from "@/components/cultural-map/ChinaProvinceMap";
import ExploreMotion from "@/components/ExploreMotion";
import { CulturalCaseIdSchema, ProvinceCodeSchema, SolarTermIdSchema } from "@/lib/contracts/cultural-case";
import { INITIAL_EXPLORE_SELECTION } from "@/lib/explore-selection";
import { studioCaseForTerm } from "@/lib/server/cultural-case-context";
import { readVisitOrigin } from "@/lib/visit-links";
import "./explore.css";
import "./explore-motion.css";
export const metadata: Metadata = { title: "知时" };
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

async function SelectedMap({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const term = SolarTermIdSchema.safeParse(params.solarTermId);
  const province = ProvinceCodeSchema.safeParse(params.provinceCode);
  const caseId = CulturalCaseIdSchema.safeParse(params.caseId);
  const item = term.success && caseId.success ? studioCaseForTerm(caseId.data, term.data) : undefined;
  return <ChinaProvinceMap visitOrigin={readVisitOrigin(params)} initialSelection={{
    ...INITIAL_EXPLORE_SELECTION,
    solarTermId: term.data ?? null,
    provinceCode: province.data ?? null,
    caseId: item && province.success && (item.provinceCode === province.data || item.relatedProvinceCodes?.includes(province.data)) ? item.id : null,
  }} />;
}

export default function ExplorePage({ searchParams }: { searchParams: SearchParams }) {
  return <ExploreMotion>
    <div className="intro explore-intro">
      <div className="explore-title">
        <h1 aria-label="循四时，访山河">
          <span aria-hidden="true">循四时，</span>
          <span aria-hidden="true">访山河</span>
        </h1>
        <p className="intro-description">按节气或地区查找地方故事。</p>
      </div>
      <span className="explore-intro-seal" aria-hidden="true">知时</span>
    </div>
    <div className="explore-map-layout"><Suspense fallback={<p className="muted" role="status">正在展开山河风物…</p>}><SelectedMap searchParams={searchParams} /></Suspense></div>
  </ExploreMotion>;
}
