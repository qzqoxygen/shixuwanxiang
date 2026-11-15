import type { Metadata } from "next";
import { Suspense } from "react";
import InkLandscape from "@/components/InkLandscape";
import { SolarTermIdSchema } from "@/lib/contracts/cultural-case";
import { studioCaseForTerm } from "@/lib/server/cultural-case-context";
import { readVisitOrigin, visitHref } from "@/lib/visit-links";
import StudioWorkbench, { StudioLoading } from "./StudioWorkbench";
import "./studio.css";

export const metadata: Metadata = { title: "造物" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function SelectedStudio({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { caseId, solarTermId, memory, source } = params;
  const term = SolarTermIdSchema.safeParse(solarTermId);
  const item = caseId !== undefined && term.success ? studioCaseForTerm(caseId, term.data) : undefined;
  const seed = item && term.success ? {
    caseId: item.id, title: item.title, provinceCode: item.provinceCode, provinceName: item.provinceName,
    regionName: item.regionName, solarTermId: term.data,
  } : undefined;
  const memoryMode = memory === "1" && caseId === undefined;
  const visitOrigin = readVisitOrigin(params);
  const webMode = source === "web" && caseId === undefined && !memoryMode;
  const key = seed ? `${seed.caseId}:${seed.solarTermId}` : memoryMode || webMode ? `${memoryMode ? "memory" : "web"}:${visitHref(visitOrigin)}` : "regular";
  return <StudioWorkbench key={key} seed={seed} invalidCase={caseId !== undefined && !seed}
    memoryMode={memoryMode} webMode={webMode} visitOrigin={visitOrigin} />;
}

export default function StudioPage({ searchParams }: { searchParams: SearchParams }) {
  return <>
    <InkLandscape />
    <Suspense fallback={<StudioLoading />}><SelectedStudio searchParams={searchParams} /></Suspense>
  </>;
}
