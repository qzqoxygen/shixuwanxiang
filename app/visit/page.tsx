import type { Metadata } from "next";
import { Suspense } from "react";
import { readVisitFilters, visitHref } from "@/lib/visit-links";
import VisitDesk from "./VisitDesk";
import "./visit.css";

export const metadata: Metadata = { title: "节气探访" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function SelectedVisit({ searchParams }: { searchParams: SearchParams }) {
  const query = readVisitFilters(await searchParams);
  return <VisitDesk key={visitHref(query)} initialQuery={query} />;
}

export default function VisitPage({ searchParams }: { searchParams: SearchParams }) {
  return <div className="visit-page">
    <header className="visit-heading">
      <h1>节气探访</h1>
      <p>选一个省份和节气，看看当地有什么习俗。AI 优先查本站案例，资料不足时尝试联网补查。</p>
    </header>
    <Suspense fallback={<p className="visit-waiting" role="status">正在打开节气探访…</p>}>
      <SelectedVisit searchParams={searchParams} />
    </Suspense>
  </div>;
}
