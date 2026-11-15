"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef } from "react";
import { fetchCaseDetail, fetchCaseList } from "@/lib/cultural-case-client";
import { CASE_PAGE_SIZE } from "@/lib/explore-selection";
import { studioCaseHref } from "@/lib/studio-inspiration";
import { visitHref, visitLinkParams } from "@/lib/visit-links";
import { SEASONS, SOLAR_TERMS, type SolarTermId } from "@/lib/solar-terms";
import type { CaseListQuery, VerifiedCulturalCase } from "@/lib/contracts/cultural-case";
import { useProvinces } from "./ProvinceInteraction";
import CulturalCaseContent, { CATEGORY_LABELS } from "./CulturalCaseContent";
import { useCaseRequest } from "./useCaseRequest";
import "./CulturalCaseExplorer.css";

export function SolarTermFilter() {
  const { selection, dispatch, setHovered, setFocused } = useProvinces();
  const id = useId();
  const selectedTerm = SOLAR_TERMS.find(term => term.id === selection.solarTermId);
  function choose(value: SolarTermId | null) {
    setHovered(null); setFocused(null);
    dispatch({ type: "term", value });
  }
  return <section className="case-term-filter" aria-labelledby={`${id}-title`}>
    <header className="case-term-header">
      <div className="case-term-caption"><h3 id={`${id}-title`}>二十四节气</h3></div>
      <button className="case-term-all" type="button" aria-pressed={selection.solarTermId === null} onClick={() => choose(null)}>全部节气</button>
    </header>
    <div className="case-season-list">
      {SEASONS.map(season => <div className={`case-season-row case-season-${season.id}`} data-active={selectedTerm?.season === season.id} key={season.id} role="group" aria-label={`${season.name}季节气`}>
        <span className="case-season-mark" aria-hidden="true">{season.name}</span>
        <div className="case-term-options">
          {SOLAR_TERMS.filter(term => term.season === season.id).map(term => <button type="button" key={term.id} aria-pressed={selection.solarTermId === term.id} onClick={() => choose(term.id)}>{term.name}</button>)}
        </div>
      </div>)}
    </div>
    {selectedTerm && <details className="case-term-insight" key={selectedTerm.id}><summary>了解{selectedTerm.name}</summary><p>{selectedTerm.description}</p></details>}
  </section>;
}

function RequestError({ message, retry }: { message: string; retry: () => void }) {
  return <div className="case-request-error"><h4>暂时无法读取案例</h4><p role="alert">{message}</p><button type="button" onClick={retry}>重新加载</button></div>;
}

function CaseLoading({ detail = false }: { detail?: boolean }) {
  return <div className="case-loading" aria-busy="true">
    <p className="case-feedback" role="status">{detail ? "正在加载详情…" : "正在查找案例…"}</p>
    <div className={`case-skeleton${detail ? " case-skeleton-detail" : ""}`} aria-hidden="true">
      {Array.from({ length: detail ? 1 : 3 }, (_, index) => <div className="case-skeleton-row" key={index}><i /><i /><i /></div>)}
    </div>
  </div>;
}

function CaseResults({ query }: { query: CaseListQuery }) {
  const { selection, dispatch, setHovered, setFocused } = useProvinces();
  const load = useCallback((signal: AbortSignal) => fetchCaseList({ solarTermId: query.solarTermId, provinceCode: query.provinceCode, offset: query.offset, limit: CASE_PAGE_SIZE }, signal), [query.solarTermId, query.provinceCode, query.offset]);
  const { resource, retry } = useCaseRequest(load);
  if (resource.status === "loading") return <CaseLoading />;
  if (resource.status === "error") return <RequestError message={resource.message} retry={retry} />;
  const { items, total, offset, limit } = resource.data;
  function open(item: VerifiedCulturalCase) {
    setHovered(null); setFocused(null);
    dispatch({ type: "open", caseId: item.id, provinceCode: selection.provinceCode ?? item.provinceCode });
  }
  return <div className="case-list-results">
    {items.length === 0 ? <div className="case-empty"><h4 role="status">当前筛选暂无案例</h4><div className="case-empty-actions">{selection.provinceCode && <button type="button" onClick={() => { dispatch({ type: "province", value: null }); setHovered(null); setFocused(null); }}>保留节气，查看全国</button>}<button type="button" onClick={() => { dispatch({ type: "reset" }); setHovered(null); setFocused(null); }}>查看全部案例</button></div></div> : <>
      <p className="case-result-count" role="status">共 {total} 则案例</p>
      <ul className="case-list">
        {items.map(item => <li key={item.id}><button type="button" className="case-card" id={`case-card-${item.id}`} aria-pressed={selection.caseId === item.id} aria-controls="culture-case-detail" onClick={() => open(item)}>
          <span className="case-card-meta"><span>{CATEGORY_LABELS[item.category]}</span><span>{item.provinceName}</span><span className="case-card-source">{item.sources.length} 条来源</span></span>
          <h4>{item.title}</h4>
          <p>{item.description}</p>
        </button></li>)}
      </ul>
    </>}
    {total > limit && <nav className="case-pagination" aria-label="文化案例分页">
      <button type="button" disabled={offset === 0} onClick={() => dispatch({ type: "page", value: Math.max(0, offset - limit) })}>上一页</button>
      <span>第 {Math.floor(offset / limit) + 1} / {Math.ceil(total / limit)} 页</span>
      <button type="button" disabled={offset + limit >= total} onClick={() => dispatch({ type: "page", value: offset + limit })}>下一页</button>
    </nav>}
  </div>;
}

function CaseDetail({ caseId }: { caseId: string }) {
  const { selection, dispatch, visitOrigin } = useProvinces();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const load = useCallback(async (signal: AbortSignal) => {
    const item = await fetchCaseDetail(caseId, signal);
    if ((selection.solarTermId && !item.solarTermIds.includes(selection.solarTermId)) || (selection.provinceCode && item.provinceCode !== selection.provinceCode && !item.relatedProvinceCodes?.includes(selection.provinceCode))) throw new Error("案例详情与当前筛选不一致，请重新选择。");
    return item;
  }, [caseId, selection.solarTermId, selection.provinceCode]);
  const { resource, retry } = useCaseRequest(load);
  useEffect(() => { headingRef.current?.focus(); }, []);
  return <section className="case-detail" aria-labelledby="case-detail-title" aria-busy={resource.status === "loading"}>
    <div className="case-detail-top">
      <button type="button" onClick={() => {
        dispatch({ type: "close" });
        requestAnimationFrame(() => (document.getElementById(`case-card-${caseId}`) ?? document.getElementById("cultural-case-explorer"))?.focus());
      }}>返回列表</button>
    </div>
    <h3 className="case-detail-name" id="case-detail-title" ref={headingRef} tabIndex={-1}>{resource.status === "success" ? resource.data.title : "案例详情"}</h3>
    {resource.status === "loading" && <CaseLoading detail />}
    {resource.status === "error" && <RequestError message={resource.message} retry={retry} />}
    {resource.status === "success" && <>
      <Link className="case-studio-link" href={studioCaseHref(
        { caseId, solarTermId: selection.solarTermId ?? resource.data.solarTermIds[0] },
        visitOrigin ? visitLinkParams(visitOrigin) : undefined,
      )} prefetch={false}>
        用这个案例做节气卡
      </Link>
      {visitOrigin && <Link className="case-studio-link" href={visitHref(visitOrigin)} prefetch={false}>返回节气探访</Link>}
      <CulturalCaseContent item={resource.data} />
    </>}
  </section>;
}

export default function CulturalCaseExplorer() {
  const { provinces, selection } = useProvinces();
  const termName = SOLAR_TERMS.find(term => term.id === selection.solarTermId)?.name ?? "全部节气";
  const provinceName = provinces.find(province => province.id === selection.provinceCode)?.name ?? "全国";
  const key = `${selection.solarTermId ?? "all"}-${selection.provinceCode ?? "all"}-${selection.offset}`;
  const query: CaseListQuery = { ...(selection.solarTermId ? { solarTermId: selection.solarTermId } : {}), ...(selection.provinceCode ? { provinceCode: selection.provinceCode } : {}), offset: selection.offset, limit: CASE_PAGE_SIZE };
  return <section className="case-explorer" id="cultural-case-explorer" tabIndex={-1} aria-labelledby="case-explorer-title">
    <header className="case-explorer-heading">
      <h2 id="case-explorer-title">一方风物</h2>
      <span aria-label={`当前筛选：${termName}，${provinceName}`}>{termName}<i aria-hidden="true"> / </i>{provinceName}</span>
    </header>
    <div className="case-list-panel" hidden={Boolean(selection.caseId)}><CaseResults key={key} query={query} /></div>
    <div id="culture-case-detail" hidden={!selection.caseId}>
      {selection.caseId && <CaseDetail key={`${key}-${selection.caseId}`} caseId={selection.caseId} />}
    </div>
  </section>;
}
