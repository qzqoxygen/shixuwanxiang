import type { Metadata } from "next";
import { Suspense } from "react";
import InkLandscape from "@/components/InkLandscape";
import { SolarTermIdSchema } from "@/lib/contracts/cultural-case";
import { studioCaseForTerm } from "@/lib/server/cultural-case-context";
import StudioWorkbench, { StudioLoading } from "./StudioWorkbench";
import "./studio.css";

export const metadata: Metadata = { title: "造物" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function SelectedStudio({ searchParams }: { searchParams: SearchParams }) {
  const { caseId, solarTermId } = await searchParams;
  const term = SolarTermIdSchema.safeParse(solarTermId);
  const item = caseId !== undefined && term.success ? studioCaseForTerm(caseId, term.data) : undefined;
  const seed = item && term.success ? {
    caseId: item.id, title: item.title, provinceName: item.provinceName, regionName: item.regionName, solarTermId: term.data,
  } : undefined;
  return <StudioWorkbench key={seed ? `${seed.caseId}:${seed.solarTermId}` : "regular"} seed={seed} invalidCase={caseId !== undefined && !seed} />;
}

export default function StudioPage({ searchParams }: { searchParams: SearchParams }) {
  return <>
    <InkLandscape />
    <Suspense fallback={<StudioLoading />}><SelectedStudio searchParams={searchParams} /></Suspense>
  </>;
}
