"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { SUPPORTED_PROVINCES } from "@/lib/provinces";
import { SEASONS, SOLAR_TERMS } from "@/lib/solar-terms";
import { VisitMemoryCardSchema, VisitMemoryRequestSchema, VisitQuerySchema, VisitResultSchema, VisitWebSeedSchema, type VisitQuery, type VisitResult } from "@/lib/solar-visit";
import { studioCaseHref } from "@/lib/studio-inspiration";
import { DEFAULT_VISIT, visitHref, visitLinkParams, visitMemoryKeys, visitWebKey } from "@/lib/visit-links";
import { readVisitEntry, readVisitSnapshot, saveVisitEntry } from "./visit-session";

const examples: { label: string; query: VisitQuery }[] = [
  { label: "浙江怎么过冬至？", query: DEFAULT_VISIT },
  { label: "宁海怎么过冬至？", query: { provinceCode: "330000", solarTermId: "dongzhi", area: "宁海县" } },
];

async function postVisit(url: string, input: object, signal: AbortSignal) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.getRandomValues(new Uint32Array(4)).join("-") },
    body: JSON.stringify(input),
    signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : "探访暂时失败，请重试。");
  return body as unknown;
}

function requestError(failure: unknown, fallback: string) {
  return failure instanceof Error && failure.name === "Error" ? failure.message : fallback;
}

const subscribe = () => () => {};
const serverSnapshot = () => undefined;

export default function VisitDesk({ initialQuery }: { initialQuery: VisitQuery }) {
  const snapshot = useSyncExternalStore(subscribe, readVisitSnapshot, serverSnapshot);
  if (snapshot === undefined) return <p className="visit-waiting" role="status">正在打开节气探访…</p>;
  return <VisitSearch initialQuery={initialQuery} snapshot={snapshot} />;
}

function VisitSearch({ initialQuery, snapshot }: { initialQuery: VisitQuery; snapshot: string | null }) {
  const [query, setQuery] = useState(initialQuery);
  const [finished, setFinished] = useState<{ query: VisitQuery; result: VisitResult; fresh: boolean } | null>(() => {
    const result = readVisitEntry(snapshot, initialQuery)?.result;
    return result ? { query: initialQuery, result, fresh: false } : null;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const areaInput = useRef<HTMLInputElement>(null);
  const submitButton = useRef<HTMLButtonElement>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function search(next: VisitQuery) {
    if (pending.current) return;
    const parsed = VisitQuerySchema.safeParse(next);
    if (!parsed.success) { setError("市县名称请填写 20 字以内的中文地名。"); return; }
    const controller = new AbortController();
    pending.current = controller;
    setQuery(parsed.data);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = VisitResultSchema.parse(await postVisit("/api/visit", parsed.data, controller.signal));
      if (!controller.signal.aborted) {
        // Keep successful queries in the address bar so back/forward and copied links restore the same scope.
        window.history.replaceState(null, "", visitHref(parsed.data));
        saveVisitEntry(parsed.data, { result });
        setFinished({ query: parsed.data, result, fresh: true });
      }
    } catch (failure) {
      if (!controller.signal.aborted) setError(requestError(failure, "暂时无法完成探访，请重试。"));
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }

  function refine() {
    if (finished) setQuery(finished.query);
    areaInput.current?.focus();
  }

  function cancelSearch() {
    pending.current?.abort();
    pending.current = null;
    setBusy(false);
    setNotice("已取消查询，可以重新探访。");
    requestAnimationFrame(() => submitButton.current?.focus());
  }

  return <div className="visit-desk">
    <form className="visit-filters" onSubmit={event => { event.preventDefault(); void search(query); }}>
      <h2>想探访哪里？</h2>
      <label>省份
        <select name="province" value={query.provinceCode} disabled={busy} onChange={event => {
          const province = SUPPORTED_PROVINCES.find(({ code }) => code === event.target.value);
          if (province) setQuery({ ...query, provinceCode: province.code, area: "" });
        }}>
          {SUPPORTED_PROVINCES.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
        </select>
      </label>
      <label>节气
        <select name="term" value={query.solarTermId} disabled={busy} onChange={event => {
          const term = SOLAR_TERMS.find(({ id }) => id === event.target.value);
          if (term) setQuery({ ...query, solarTermId: term.id });
        }}>
          {SEASONS.map(season => <optgroup key={season.id} label={season.name}>
            {SOLAR_TERMS.filter(term => term.season === season.id).map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </optgroup>)}
        </select>
      </label>
      <label>市县（选填）
        <input ref={areaInput} name="area" maxLength={20} value={query.area} disabled={busy}
          onChange={event => setQuery({ ...query, area: event.target.value })} placeholder="例如：三门县" />
      </label>
      <div className="visit-query-actions">
        <button ref={submitButton} type="submit" className="visit-primary" disabled={busy}>{busy ? "正在探访…" : "问问这里怎么过节气"}</button>
        {busy && <button type="button" className="visit-refine" onClick={cancelSearch}>取消查询</button>}
      </div>
      {error && <p className="visit-error" role="alert">{error}</p>}
      <div className="visit-examples" aria-label="示例问题">
        {examples.map(example => <button type="button" key={example.label} disabled={busy}
          onClick={() => void search(example.query)}>{example.label}</button>)}
      </div>
    </form>
    <div className="visit-journal">
      {busy && <p className="visit-waiting" role="status">正在探访{SUPPORTED_PROVINCES.find(({ code }) => code === query.provinceCode)?.name}{query.area}的{SOLAR_TERMS.find(({ id }) => id === query.solarTermId)?.name}风物。本站没有匹配案例时，会继续联网补查。</p>}
      {notice && <p className="visit-waiting" role="status">{notice}</p>}
      {finished && <div hidden={busy}>
        <VisitResultPage key={visitHref(finished.query)} query={finished.query} result={finished.result} fresh={finished.fresh} onRefine={refine}
          onProvince={() => void search({ ...finished.query, area: "" })} onRetry={() => void search(finished.query)} />
      </div>}
      {!busy && !finished && !notice && <p className="visit-waiting">选好省份和节气，就可以从家乡的一件小事问起。</p>}
    </div>
  </div>;
}

function VisitResultPage({ query, result, fresh, onRefine, onProvince, onRetry }: {
  query: VisitQuery; result: VisitResult; fresh: boolean; onRefine: () => void; onProvince: () => void; onRetry: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [handoffError, setHandoffError] = useState("");
  useEffect(() => { if (fresh) heading.current?.focus(); }, [fresh, result]);
  const province = SUPPORTED_PROVINCES.find(({ code }) => code === query.provinceCode)!.name;
  const term = SOLAR_TERMS.find(({ id }) => id === query.solarTermId)!;
  const place = [province, query.area].filter(Boolean).join(" · ");
  const cases = result.kind === "local" ? result.cases : result.nearby;
  const origin = visitLinkParams(query);
  const webSeed = result.kind === "web" ? VisitWebSeedSchema.safeParse({ query, evidence: result.evidence }).data : undefined;
  const caseList = cases.length > 0 && <ol className="visit-cases" aria-label="文化案例">
    {cases.map((item, index) => <li key={item.id}>
      <p className="visit-case-place">案例 {index + 1} · {item.regionName}</p>
      <h3>{item.title}</h3>
      <p>{item.description}</p>
      <div className="visit-links visit-case-actions">
        <Link className="visit-primary" prefetch={false} href={studioCaseHref({ caseId: item.id, solarTermId: term.id }, origin)}>用这条案例做节气卡</Link>
        <Link className="visit-secondary" prefetch={false} href={`/explore?${new URLSearchParams({ solarTermId: term.id, provinceCode: query.provinceCode, caseId: item.id, ...origin })}#cultural-case-explorer`}>在知时看地图</Link>
      </div>
      <details className="visit-sources">
        <summary>查看资料出处</summary>
        <ul>{item.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a></li>)}</ul>
      </details>
    </li>)}
  </ol>;
  return <>
    <header className="visit-result-heading">
      <p role="status">{place} · {term.name}</p>
      <h2 ref={heading} tabIndex={-1}>{result.kind === "local" ? "本站已核验案例" : result.kind === "web" ? "联网查到的地方记录" : result.kind === "lead" ? "找到一条家乡线索" : "从家乡的一件小事说起"}</h2>
    </header>
    {result.kind === "local" && result.answer && <p className="visit-answer">{result.answer}</p>}
    {(result.kind === "web" || result.kind === "lead") && <article className="visit-evidence">
      {result.kind === "lead" && <p>这条资料记录了当地风物，和{term.name}的具体关系还需要核实。</p>}
      <h3>{result.evidence.title}</h3>
      <blockquote aria-label="检索摘要">{result.evidence.quote}</blockquote>
      <div className="visit-links visit-evidence-actions">
        {webSeed && <Link className="visit-primary" href={`/studio?${new URLSearchParams({ source: "web", ...origin })}`} prefetch={false} onNavigate={event => {
          try { sessionStorage.setItem(visitWebKey(query), JSON.stringify(webSeed)); }
          catch {
            event.preventDefault();
            setHandoffError("暂时无法把资料带入工坊，请在同一浏览器标签中重试。");
          }
        }}>用这条资料做节气卡</Link>}
        {result.kind === "web" && !webSeed && <button type="button" className="visit-refine" onClick={onRetry}>刷新资料以创作</button>}
        <a href={result.evidence.url} target="_blank" rel="noreferrer">查看资料原文 <span aria-label="新窗口打开">↗</span></a>
      </div>
      {handoffError && <p className="visit-error" role="alert">{handoffError}</p>}
    </article>}
    {result.kind === "none" && <p className="visit-answer">
      {result.search === "empty" ? "补查后暂时没有找到能核实的地方记录。" : "联网补查暂时不可用，可以稍后再试。"}
    </p>}
    {result.kind === "local" ? caseList : cases.length > 0 && <details className="visit-other-cases">
      <summary>同省其他地方的案例（{cases.length}）</summary>
      {caseList}
    </details>}
    {result.kind !== "local" && <>
      <div className="visit-query-actions">
        {result.kind === "none" && result.search === "unavailable" && <button type="button" className="visit-refine" onClick={onRetry}>重试补查</button>}
        {query.area && <button type="button" className="visit-refine" onClick={onProvince}>查看全省</button>}
        <button type="button" className="visit-refine" onClick={onRefine}>{query.area ? "换个市县再查" : "填写市县再查"}</button>
      </div>
      <MemoryCard query={query} termName={term.name} initiallyOpen={result.kind === "none"} />
    </>}
    <nav className="visit-links visit-related" aria-label="继续探索">
      <Link className="visit-secondary visit-related-seasons" prefetch={false} href={`/seasons?${new URLSearchParams({ solarTermId: term.id, ...origin })}`}>在四时读{term.name}</Link>
      <Link className="visit-secondary" prefetch={false} href={`/explore?${new URLSearchParams({ solarTermId: term.id, provinceCode: query.provinceCode, ...origin })}#cultural-case-explorer`}>在知时看{province}风物</Link>
    </nav>
  </>;
}

function MemoryCard({ query, termName, initiallyOpen }: { query: VisitQuery; termName: string; initiallyOpen: boolean }) {
  const [saved] = useState(() => readVisitEntry(readVisitSnapshot(), query));
  const [memory, setMemory] = useState(saved?.memory ?? "");
  const [card, setCard] = useState(saved?.card ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function write(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const input = VisitMemoryRequestSchema.safeParse({ solarTermId: query.solarTermId, memory });
    if (!input.success) { setError("请写下 4 至 240 字的家乡记忆。"); return; }
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError("");
    try {
      const result = VisitMemoryCardSchema.parse(await postVisit("/api/visit/memory", input.data, controller.signal));
      if (!controller.signal.aborted) {
        setCard(result);
        saveVisitEntry(query, { memory, card: result });
      }
    } catch (failure) {
      if (!controller.signal.aborted) setError(requestError(failure, "暂时无法写成卡片，请重试。"));
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return <details className="visit-memory" open={initiallyOpen || Boolean(saved?.memory)}>
    <summary>写下我的家乡记忆</summary>
    <form onSubmit={write}>
    <label>你记得家里怎么过{termName}吗？
      <textarea required minLength={4} maxLength={240} rows={3} value={memory} disabled={busy}
        onChange={event => {
          setMemory(event.target.value);
          setCard(null);
          saveVisitEntry(query, { memory: event.target.value, card: undefined });
        }} placeholder="可以是一道菜、一种声音，或一次和家人一起做的事。" />
    </label>
    <button type="submit" className="visit-primary" disabled={busy}>{busy ? "正在写卡片…" : "请 AI 写成节气卡"}</button>
    {error && <p className="visit-error" role="alert">{error}</p>}
    {card && <div className="visit-memory-preview" aria-live="polite">
      <strong>{card.title}</strong>
      <p>{card.line}</p>
      <Link href={`/studio?${new URLSearchParams({ memory: "1", ...visitLinkParams(query) })}`} prefetch={false} onNavigate={event => {
        try {
          const payload = JSON.stringify(card);
          const keys = visitMemoryKeys(query);
          if (sessionStorage.getItem(keys.card) !== payload) {
            sessionStorage.setItem(keys.card, payload);
            sessionStorage.removeItem(keys.draft);
          }
        } catch {
          event.preventDefault();
          setError("浏览器暂时无法传入工坊，可以复制上面的文字。");
        }
      }}>去造物编辑并保存</Link>
    </div>}
    </form>
  </details>;
}
