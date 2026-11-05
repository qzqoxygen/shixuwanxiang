"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { fetchCaseDetail, fetchCaseList } from "@/lib/cultural-case-client";
import { CASE_PAGE_SIZE } from "@/lib/explore-selection";
import { SEASONS, SOLAR_TERMS, type SolarTermId } from "@/lib/solar-terms";
import type { CaseListQuery, CulturalCategory, VerifiedCulturalCase } from "@/lib/contracts/cultural-case";
import { useProvinces } from "./ProvinceInteraction";
import "./CulturalCaseExplorer.css";

const CATEGORY_LABELS: Record<CulturalCategory, string> = { folk_custom: "民俗", agriculture: "农事", craft: "技艺", food: "饮食", other: "其他" };
type Resource<T> = { status: "loading" } | { status: "success"; data: T } | { status: "error"; message: string };

// Each result view is keyed by its selection. Unmounting cancels the old request;
// the active flag also protects against transports that finish after cancellation.
function useCaseRequest<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [resource, setResource] = useState<Resource<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    load(controller.signal).then(data => {
      if (active) setResource({ status: "success", data });
    }).catch(error => {
      if (!active) return;
      const message = controller.signal.aborted ? "案例请求超时，请重试。" : error instanceof TypeError ? "网络连接异常，请检查网络后重试。" : error instanceof Error ? error.message : "案例暂时无法读取，请重试。";
      setResource({ status: "error", message });
    }).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [load, attempt]);
  return { resource, retry: () => { setResource({ status: "loading" }); setAttempt(value => value + 1); } };
}

export function SolarTermFilter() {
  const { selection, dispatch, setHovered, setFocused } = useProvinces();
  const id = useId();
  const selectedTerm = SOLAR_TERMS.find(term => term.id === selection.solarTermId);
  function choose(value: SolarTermId | null) {
    setHovered(null); setFocused(null);
    dispatch({ type: "term", value });
  }
  return <section className="case-term-filter" aria-labelledby={`${id}-title`} aria-describedby={`${id}-hint`}>
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
    <footer className="case-term-footer"><p id={`${id}-hint`}>选择节气，点开浮起的省份浏览案例。</p><span role="status">{selectedTerm ? `当前节气：${selectedTerm.name}` : "当前：全部节气"}</span></footer>
    {selectedTerm && <details className="case-term-insight" key={selectedTerm.id}><summary>了解{selectedTerm.name}<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></summary><p>{selectedTerm.description}</p></details>}
  </section>;
}

function RequestError({ message, retry }: { message: string; retry: () => void }) {
  return <div className="case-request-error"><h4>暂时无法读取案例</h4><p role="alert">{message}</p><button type="button" onClick={retry}>重新加载</button></div>;
}

function CaseLoading({ detail = false }: { detail?: boolean }) {
  return <div className="case-loading" aria-busy="true">
    <p className="case-feedback" role="status">{detail ? "正在展开案例详情…" : "正在查找符合条件的案例…"}</p>
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
    dispatch({ type: "open", caseId: item.id, provinceCode: item.provinceCode });
  }
  return <div className="case-list-results">
    <p className="case-result-count" role="status">找到 {total} 则风物故事{items.length > 0 ? ` · 正在展示 ${offset + 1}–${offset + items.length} 则` : ""}</p>
    {items.length === 0 ? <div className="case-empty"><span aria-hidden="true">待访</span><h4>暂未找到对应案例</h4><p>当前筛选下还没有已核实的记录，素材仍在整理中。可以换个地区或节气继续探索。</p><div className="case-empty-actions">{selection.provinceCode && <button type="button" onClick={() => { dispatch({ type: "province", value: null }); setHovered(null); setFocused(null); }}>保留节气，查看全国</button>}<button type="button" onClick={() => { dispatch({ type: "reset" }); setHovered(null); setFocused(null); }}>查看全部案例</button></div></div> : <ul className="case-list">
      {items.map(item => <li key={item.id}><button type="button" className="case-card" id={`case-card-${item.id}`} aria-pressed={selection.caseId === item.id} aria-controls="culture-case-detail" onClick={() => open(item)}>
        <span className="case-card-meta"><span>{CATEGORY_LABELS[item.category]}</span><span>{item.provinceName}</span><span className="case-card-source">{item.sources.length} 条来源</span></span>
        <h4>{item.title}</h4><p>{item.description}</p><span className="case-card-link">{selection.caseId === item.id ? "已展开" : "查看详情"} <span aria-hidden="true">{selection.caseId === item.id ? "✓" : "↗"}</span></span>
      </button></li>)}
    </ul>}
    {total > limit && <nav className="case-pagination" aria-label="文化案例分页">
      <button type="button" disabled={offset === 0} onClick={() => dispatch({ type: "page", value: Math.max(0, offset - limit) })}>上一页</button>
      <span>第 {Math.floor(offset / limit) + 1} / {Math.ceil(total / limit)} 页</span>
      <button type="button" disabled={offset + limit >= total} onClick={() => dispatch({ type: "page", value: offset + limit })}>下一页</button>
    </nav>}
  </div>;
}

function CaseDetail({ caseId }: { caseId: string }) {
  const { selection, dispatch } = useProvinces();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const load = useCallback(async (signal: AbortSignal) => {
    const item = await fetchCaseDetail(caseId, signal);
    if ((selection.solarTermId && !item.solarTermIds.includes(selection.solarTermId)) || (selection.provinceCode && item.provinceCode !== selection.provinceCode)) throw new Error("案例详情与当前筛选不一致，请重新选择。");
    return item;
  }, [caseId, selection.solarTermId, selection.provinceCode]);
  const { resource, retry } = useCaseRequest(load);
  useEffect(() => { headingRef.current?.focus(); }, []);
  return <section className="case-detail" id="culture-case-detail" aria-labelledby="case-detail-title" aria-busy={resource.status === "loading"}>
    <div className="case-detail-top"><h3 id="case-detail-title" ref={headingRef} tabIndex={-1}>风物详录</h3><button type="button" onClick={() => { dispatch({ type: "close" }); requestAnimationFrame(() => document.getElementById(`case-card-${caseId}`)?.focus()); }}>关闭详情</button></div>
    {resource.status === "loading" && <CaseLoading detail />}
    {resource.status === "error" && <RequestError message={resource.message} retry={retry} />}
    {resource.status === "success" && <>
      <p className="case-detail-meta">{resource.data.regionName} · {CATEGORY_LABELS[resource.data.category]}</p>
      <h4 className="case-detail-name">{resource.data.title}</h4>
      <p className="case-detail-terms">{SOLAR_TERMS.filter(term => resource.data.solarTermIds.includes(term.id)).map(term => term.name).join(" · ")}</p>
      {resource.data.imageUrl && <Image className="case-detail-image" src={resource.data.imageUrl} alt={resource.data.title} width={720} height={480} />}
      <p className="case-detail-description">{resource.data.description}</p>
      <h5>与节气的关联</h5><p className="case-detail-relation">{resource.data.relationNote}</p>
      <div className="case-sources"><h5>资料来源</h5><ul>{resource.data.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} <span aria-hidden="true">↗</span></a>{source.publisher && <span>{source.publisher}</span>}</li>)}</ul><p>本页为已核实资料的简要整理，点击来源可查看原始记述。</p></div>
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
    <header className="case-explorer-heading"><div><h3 id="case-explorer-title">一方风物</h3><p>沿着节气，读地方故事与真实出处。</p></div><span>{termName}<i aria-hidden="true"> / </i>{provinceName}</span></header>
    <div className="case-explorer-columns"><div className="case-list-panel"><CaseResults key={key} query={query} /></div>
      {selection.caseId ? <CaseDetail key={`${key}-${selection.caseId}`} caseId={selection.caseId} /> : <div className="case-detail-placeholder" id="culture-case-detail"><span aria-hidden="true">阅</span><h4>把一方风物，慢慢读懂。</h4><p>从左侧选一则故事，<br />在这里了解节气关联与资料来源。</p></div>}
    </div>
  </section>;
}
