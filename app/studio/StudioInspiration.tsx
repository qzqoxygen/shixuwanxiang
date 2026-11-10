import { useEffect, useRef, useState } from "react";
import { readStudioSuggestions, type StudioFormat, type StudioSuggestion } from "@/lib/studio-inspiration";

type Props = {
  term: { id: string; name: string };
  format: StudioFormat;
  onApply: (field: keyof StudioSuggestion, value: string) => void;
};

export default function StudioInspiration({ term, format, onApply }: Props) {
  const request = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<StudioSuggestion[]>([]);
  const [status, setStatus] = useState("生成标题和短句，选中后再填入作品。");

  useEffect(() => () => request.current?.abort(), []);

  async function generate() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setStatus(`正在为${term.name}生成灵感…`);
    try {
      const query = new URLSearchParams({ term: term.id, format });
      const response = await fetch(`/api/studio/inspiration?${query}`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.getRandomValues(new Uint32Array(4)).join("-") },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]),
      });
      const body = await response.json();
      if (controller.signal.aborted) return;
      const results = response.ok ? readStudioSuggestions(body) : [];
      if (results.length) {
        setSuggestions(results);
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
    setStatus(`已填入${field === "title" ? "标题" : "短句"}：${value}`);
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
      <p className="studio-inspiration-status" role="status">{status}</p>
      {suggestions.length > 0 && (
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
      )}
    </div>
  );
}
