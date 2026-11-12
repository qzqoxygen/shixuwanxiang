"use client";

import Link from "next/link";
import { useCallback } from "react";
import { fetchSolarTermCases } from "@/lib/cultural-case-client";
import type { SolarTermId } from "@/lib/solar-terms";
import CulturalCaseContent, { CATEGORY_LABELS } from "../cultural-map/CulturalCaseContent";
import { useCaseRequest } from "../cultural-map/useCaseRequest";
import "../cultural-map/CulturalCaseExplorer.css";
import "./SeasonalCases.css";

export default function SeasonalCases({ term }: { term: { id: SolarTermId; name: string } }) {
  const load = useCallback((signal: AbortSignal) => fetchSolarTermCases(term.id, signal), [term.id]);
  const { resource, retry } = useCaseRequest(load);
  return <section className="case-explorer seasons-cases" aria-labelledby="seasons-cases-title" data-term-id={term.id}>
    <header className="case-explorer-heading"><h2 id="seasons-cases-title">{term.name}风物</h2><Link className="text-link" href={`/explore?solarTermId=${term.id}`}>在地图中寻访 ↗</Link></header>
    {resource.status === "loading" && <p className="case-feedback" role="status">正在查找{term.name}案例…</p>}
    {resource.status === "error" && <div className="case-request-error"><p role="alert">{resource.message}</p><button type="button" onClick={retry}>重新加载</button></div>}
    {resource.status === "success" && <>
      <p className="case-result-count" role="status">{resource.data.length ? `共 ${resource.data.length} 则已核实案例，点开阅读地方故事。` : "该节气暂无已核实案例。"}</p>
      <ul className="case-list">{resource.data.map(item => <li key={item.id}>
        <details data-case-id={item.id}>
          <summary className="case-card"><span className="case-card-meta"><span>{CATEGORY_LABELS[item.category]}</span><span>{item.provinceName}</span><span className="case-card-source">{item.sources.length} 条来源</span></span><h4>{item.title}<span aria-hidden="true">＋</span></h4><p>{item.regionName}</p></summary>
          <div className="case-detail"><CulturalCaseContent item={item} /><Link className="text-link" href={`/explore?solarTermId=${term.id}&provinceCode=${item.provinceCode}`}>寻访{item.provinceName} ↗</Link></div>
        </details>
      </li>)}</ul>
    </>}
  </section>;
}
