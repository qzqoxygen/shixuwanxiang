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
      <p>选一个地方，问问那里的人怎么过节气。AI 会查找文化案例，资料不足时继续联网找线索。</p>
    </header>
    <Suspense fallback={<p className="visit-waiting" role="status">正在打开节气探访…</p>}>
      <SelectedVisit searchParams={searchParams} />
    </Suspense>
  </div>;
}
