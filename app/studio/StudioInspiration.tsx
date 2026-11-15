import { useEffect, useRef, useState } from "react";
import type { VisitWebSeed } from "@/lib/solar-visit";
import { readStudioReferences, readStudioSuggestions, type StudioCaseSeed, type StudioFormat, type StudioReference, type StudioSuggestion } from "@/lib/studio-inspiration";

type Props = {
  term: { id: string; name: string };
  format: StudioFormat;
  selectedCase?: StudioCaseSeed;
  caseOrigin?: string;
  webSeed?: VisitWebSeed;
  onApply: (field: keyof StudioSuggestion, value: string) => void;
};

export default function StudioInspiration({ term, format, selectedCase, caseOrigin = "知时", webSeed, onApply }: Props) {
  const request = useRef<AbortController | null>(null);
  const resultsPanel = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<StudioSuggestion[]>([]);
  const [references, setReferences] = useState<StudioReference[]>([]);
  const [status, setStatus] = useState("生成标题和短句，选中后再填入作品。");

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    resultsPanel.current?.scrollTo({ top: 0 });
  }, [suggestions]);

  async function generate() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setStatus(`正在为${term.name}生成灵感…`);
    try {
      const query = new URLSearchParams({ term: term.id, format });
      if (selectedCase) query.set("caseId", selectedCase.caseId);
      if (webSeed) query.set("source", "web");
      const response = await fetch(`/api/studio/inspiration?${query}`, {
        method: "POST",
        headers: {
          "Idempotency-Key": crypto.getRandomValues(new Uint32Array(4)).join("-"),
          ...(webSeed ? { "Content-Type": "application/json" } : {}),
        },
        body: webSeed ? JSON.stringify(webSeed) : undefined,
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]),
      });
      const body = await response.json();
      if (controller.signal.aborted) return;
      const results = response.ok ? readStudioSuggestions(body) : [];
      if (results.length) {
        setSuggestions(results);
        setReferences(readStudioReferences(body));
        setStatus(`${results.length} 组${term.name}灵感，可分别选用标题或短句。`);
      } else {
        setStatus(!response.ok && typeof body?.error === "string" ? body.error : "这次没能生成灵感，请重试。");
      }
    } catch {
      if (!controller.signal.aborted) setStatus("暂时未收到灵感，请重试。你可以继续编辑作品。");
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  function apply(field: keyof StudioSuggestion, value: string) {
    onApply(field, value);
    setStatus(field === "title" ? "已填入卡片标题。" : "已填入卡片短句。");
  }

  return (
    <div className="studio-inspiration" role="group" aria-labelledby="studio-inspiration-heading">
      <div className="studio-inspiration-heading">
        <h3 id="studio-inspiration-heading"><span aria-hidden="true">灵</span> AI 灵感</h3>
        <button type="button" aria-disabled={loading} onClick={generate}>
          {loading ? "生成中…" : suggestions.length ? "换一批" : "生成灵感"}
          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25">
            <path d="M3 12.5 12.5 3M6 3h6.5v6.5" />
          </svg>
        </button>
      </div>
      {selectedCase && <p className="studio-inspiration-case">
        <span>来自{caseOrigin}</span><strong>{selectedCase.title}</strong>
        <small>{[...new Set([selectedCase.provinceName, selectedCase.regionName])].join(" · ")}</small>
      </p>}
      {webSeed && <div className="studio-inspiration-case studio-web-reference">
        <span>节气探访 · 联网资料</span>
        <strong>{webSeed.evidence.title}</strong>
        <small>{webSeed.evidence.quote}</small>
        <a className="text-link" href={webSeed.evidence.url} target="_blank" rel="noreferrer">查看资料原文</a>
      </div>}
      <p className="studio-inspiration-status" role="status">{status}</p>
      {suggestions.length > 0 && (
        <div ref={resultsPanel} className="studio-inspiration-results" role="region" aria-label="灵感结果" tabIndex={0}>
          <ul className="studio-inspiration-list">
            {suggestions.map(({ title, line }) => (
              <li key={title}>
                <button type="button" onClick={() => apply("title", title)}>
                  <strong>{title}</strong><span>用作标题</span>
                </button>
                <button type="button" onClick={() => apply("line", line)}>
                  <span>{line}</span><span>用作短句</span>
                </button>
              </li>
            ))}
          </ul>
          {references.length > 0 && <details className="studio-inspiration-references">
            <summary>参考文化案例（{references.length} 则）</summary>
            <ul>{references.map(item => <li key={item.caseId}>
              <strong>{item.title}</strong><p>{item.provinceName} · {item.regionName}</p>
              {item.sources.map(source => <div key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}{source.publisher ? `（${source.publisher}）` : ""}</a>{source.accessNote && <span>{source.accessNote}</span>}</div>)}
            </li>)}</ul>
          </details>}
        </div>
      )}
    </div>
  );
}
