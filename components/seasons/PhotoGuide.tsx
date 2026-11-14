import { useEffect, useRef, useState } from "react";
import { GUIDE_MODES, isGuideTopic, readLiveGuide, type GuideCaseSource, type GuideMode, type GuideTopic } from "@/lib/season-guides";
import type { SolarTermId } from "@/lib/solar-terms";

type Props = {
  termId: SolarTermId;
  mode: GuideMode;
  intro: readonly string[];
  source?: GuideCaseSource;
  interactive: boolean;
  onModeChange: (mode: GuideMode) => void;
};

export default function PhotoGuide({ termId, mode, intro, source, interactive, onModeChange }: Props) {
  return <div className="seasons-photo-guide">
    <div className="seasons-guide-header">
      <h4>AI 风物导读</h4>
      <div className="seasons-guide-mode" role="group" aria-label="选择 AI 导读讲法">
        {(["brief", "children"] as const).map(option => (
          <button type="button" key={option} disabled={!interactive} aria-pressed={mode === option} onClick={() => onModeChange(option)}>
            {GUIDE_MODES[option]}
          </button>
        ))}
      </div>
    </div>
    <GuideContent key={`${mode}:${interactive}`} {...{ termId, mode, intro, source, interactive }} />
  </div>;
}

function GuideContent({ termId, mode, intro, source, interactive }: Omit<Props, "onModeChange">) {
  const [result, setResult] = useState<{ guide: string; topic: GuideTopic } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readingDetails, setReadingDetails] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const reading = useRef<HTMLDivElement>(null);
  const continuation = useRef<HTMLDivElement>(null);

  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    const area = reading.current;
    const section = continuation.current;
    if (result && area && section) {
      area.scrollTo({ top: area.scrollTop + section.getBoundingClientRect().top - area.getBoundingClientRect().top });
    }
  }, [result]);

  async function generate() {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(null);
    try {
      const query = new URLSearchParams({ term: termId, mode });
      if (result) query.set("previous", result.topic);
      const response = await fetch(`/api/seasons/guide?${query}`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.getRandomValues(new Uint32Array(4)).join("-") },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(58_000)]),
      });
      const data = await response.json();
      if (controller.signal.aborted) return;
      const guide = response.ok ? readLiveGuide(data) : null;
      if (guide && isGuideTopic(data?.topic)) {
        setResult({ guide, topic: data.topic });
      } else {
        setError(typeof data?.error === "string" ? data.error : "暂未收到导读，请重试。");
      }
    } catch {
      if (!controller.signal.aborted) setError("暂未收到导读，请重试。");
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return <>
    <div className="seasons-guide-copy" ref={reading} role="region" aria-label="导读正文" tabIndex={interactive ? 0 : undefined}
      onScroll={event => {
        const area = event.currentTarget;
        const section = continuation.current;
        if (!section) return;
        const distance = section.getBoundingClientRect().top - area.getBoundingClientRect().top;
        const atBottom = area.scrollTop + area.clientHeight >= area.scrollHeight - 2;
        setReadingDetails(distance <= 8 || atBottom);
      }}>
      {intro.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
      <div aria-live="polite" aria-busy={busy}>
        {result && <div className="seasons-guide-live" ref={continuation}>
          <div className="seasons-guide-live-heading">
            <span>AI 再讲一点</span>
            <span className="seasons-guide-meta">DeepSeek 实时生成</span>
          </div>
          <p>{result.guide}</p>
        </div>}
      </div>
    </div>
    {error && <p className="seasons-guide-error" role="status">{error}</p>}
    <div className="seasons-guide-actions">
      <button type="button" className="seasons-guide-primary" disabled={!interactive} aria-disabled={busy} onClick={() => {
        if (busy) return;
        if (!result) {
          void generate();
          return;
        }
        const area = reading.current;
        const section = continuation.current;
        if (area && section) area.scrollTo({ top: readingDetails ? 0 : area.scrollTop + section.getBoundingClientRect().top - area.getBoundingClientRect().top });
      }}>
        <span>{busy ? "DeepSeek 正在讲解" : result ? readingDetails ? "回到导读开头" : "查看补充讲解" : error ? "重试实时导读" : "AI 再讲一点"}</span>
        {busy
          ? <span className="seasons-guide-dots" aria-hidden="true"><i /><i /><i /></span>
          : <span className="seasons-guide-arrow" aria-hidden="true">{result ? readingDetails ? "↑" : "↓" : "→"}</span>}
      </button>
      <span className="seasons-sr-only" role="status">{busy ? "DeepSeek 正在生成补充讲解" : ""}</span>
      {result && readingDetails ? (
        <button type="button" className="seasons-guide-repeat" disabled={!interactive} aria-disabled={busy} onClick={() => void generate()}>
          <span aria-hidden="true">↻</span> 换个话题
        </button>
      ) : source && (
        <a className="seasons-guide-source" href={source.url} target="_blank" rel="noopener noreferrer" title={source.title} aria-label={`查看案例原文：${source.title}`}>
          案例原文 <span aria-hidden="true">↗</span>
        </a>
      )}
    </div>
  </>;
}
