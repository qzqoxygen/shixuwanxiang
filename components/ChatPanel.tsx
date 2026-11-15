"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { MAX_HISTORY_MESSAGES, MAX_INPUT_LENGTH, type ChatMessage } from "@/lib/chat";
import { type ChatCaseLookup, type ChatCaseReference } from "@/lib/contracts/cultural-case";
import { ChatSuccessV1Schema, type MapAction, type ToolEvent } from "@/lib/contracts/chat-api";
import { useProvinces } from "./cultural-map/ProvinceInteraction";
import { SOLAR_TERMS } from "@/lib/solar-terms";
import { studioCaseHref } from "@/lib/studio-inspiration";
import type { VisitQuery } from "@/lib/solar-visit";
import { visitLinkParams } from "@/lib/visit-links";
import "./ChatPanel.css";

type DisplayMessage = ChatMessage & {
  truncated?: boolean;
  answerText?: string;
  caseReferences?: ChatCaseReference[];
  caseLookup?: ChatCaseLookup;
  noLocalCaseMatch?: boolean;
  toolEvents?: ToolEvent[];
  mapActions?: MapAction[];
  mapRevision?: number;
};
const SUGGESTIONS = ["比较江苏和浙江的冬至习俗，在地图中高亮两省并打开三门祭冬。", "广东秋分有什么习俗？", "什么是冬至？"];
const TOOL_LABELS: Record<string, string> = {
  search_cultural_cases: "查询文化案例", compare_cultural_cases: "比较地区文化",
  show_cultural_map: "准备节气地图", highlight_regions: "标记相关地区",
  open_cultural_case: "核对案例详情", get_solar_term_info: "查询节气知识",
};

function linkedText(content: string) {
  return content.split(/(https?:\/\/[^\s<>]+)/gu).map((part, index) =>
    /^https?:\/\//u.test(part)
      ? <a key={index} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
      : part);
}

function CaseReferences({ references, onShowOnMap, visitOrigin }: {
  references: ChatCaseReference[]; onShowOnMap: (reference: ChatCaseReference) => void; visitOrigin?: VisitQuery;
}) {
  const groups = [...new Set(references.map(item => item.provinceCode))].map(code => references.filter(item => item.provinceCode === code));
  return <div className="chat-case-references">
    <p className="chat-case-heading">{groups.length > 1 ? "地区文化对照 · 已核验案例与来源" : "已核验文化案例"}</p>
    {groups.map(group => <section className="chat-region-group" key={group[0].provinceCode} aria-label={`${group[0].provinceName}文化案例`}>
    {groups.length > 1 && <h4>{group[0].provinceName}<span>{group.length} 则</span></h4>}
    <ul className="chat-case-list">
      {group.map((reference) => {
        const termName = SOLAR_TERMS.find(({ id }) => id === reference.solarTermId)?.name;
        const place = [...new Set([reference.provinceName, reference.regionName])].join(" · ");
        const [primarySource, ...otherSources] = reference.sources;
        return <li className="chat-case-card" key={reference.caseId}>
          <span className="chat-case-caption">案例 {reference.citation} · {termName}</span>
          <strong>{reference.title}</strong>
          <p className="chat-case-place">{place}</p>
          <div className="chat-case-actions">
            <button type="button" className="chat-case-map" aria-label={`在地图上查看：${reference.title}`} onClick={() => onShowOnMap(reference)}>
              在地图上查看
            </button>
            <a className="chat-case-original" href={primarySource.url} target="_blank" rel="noopener noreferrer" aria-label={`查看原文：${primarySource.title}`} title={primarySource.title}>
              查看原文
            </a>
            <Link className="chat-case-create" href={studioCaseHref(reference, visitOrigin ? visitLinkParams(visitOrigin) : undefined)} prefetch={false} aria-label={`用这个案例做节气卡：${reference.title}`}>
              做节气卡
            </Link>
          </div>
          {primarySource.accessNote && <span className="chat-case-source-note">{primarySource.accessNote}</span>}
          {otherSources.length > 0 && <ul className="chat-case-sources">
            {otherSources.map((source) => <li key={source.url}>
              <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} </a>
              {source.accessNote && <span className="chat-case-source-note">{source.accessNote}</span>}
            </li>)}
          </ul>}
        </li>;
      })}
    </ul>
    </section>)}
  </div>;
}

function MapActionsPreview({ actions, expectedRevision, currentRevision, onApply }: {
  actions: MapAction[]; expectedRevision: number; currentRevision: number;
  onApply: (actions: MapAction[], revision: number, signal: AbortSignal) => Promise<void>;
}) {
  const [status, setStatus] = useState("");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const stale = expectedRevision !== currentRevision;
  async function apply() {
    if (pending.current || stale || applied) return;
    const controller = new AbortController();
    pending.current = controller;
    setApplying(true);
    setStatus("");
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
    try {
      await onApply(actions, expectedRevision, signal);
      if (!controller.signal.aborted) { setApplied(true); setStatus("地图已更新，可查看相关地区与案例。"); }
    } catch (error) {
      if (!controller.signal.aborted) setStatus(signal.aborted ? "地图核对超时，地图未更新，请重试。" : error instanceof Error ? error.message : "地图未更新，请重新提问。");
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setApplying(false);
    }
  }
  return <div className="chat-map-actions">
    <button type="button" className="chat-case-map" disabled={stale || applying || applied} onClick={() => void apply()}>
      {applying ? "正在核对地图案例…" : applied ? "已在地图中查看" : "在地图中查看"}
    </button>
    <p role="status">{applied ? status : stale ? "回答基于之前的地图选择，未应用地图操作。请重新提问。" : status || "核对节气、地区与案例后，一次更新地图。"}</p>
  </div>;
}

export default function ChatPanel({ onShowOnMap, onApplyMapActions, visitOrigin }: {
  onShowOnMap: (reference?: ChatCaseReference) => void;
  onApplyMapActions: (actions: MapAction[], revision: number, signal: AbortSignal) => Promise<void>;
  visitOrigin?: VisitQuery;
}) {
  const { revision, getMapRevision, getChatContext, invalidateMapRevision } = useProvinces();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [discardedMessages, setDiscardedMessages] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const latestAnswerRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputId = useId();
  const busy = pending !== null;
  const isEmpty = messages.length === 0 && !busy;

  useEffect(() => () => { controllerRef.current?.abort(); controllerRef.current = null; }, []);
  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript) return;
    const answer = latestAnswerRef.current;
    if (!pending && !error && answer && answer.offsetHeight > transcript.clientHeight) {
      transcript.scrollTop += answer.getBoundingClientRect().top - transcript.getBoundingClientRect().top - 4;
    } else {
      transcript.scrollTop = transcript.scrollHeight;
    }
  }, [messages, pending, error]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (controllerRef.current) return;
    const question = input.trim();
    if (!question || input.length > MAX_INPUT_LENGTH) {
      setError(`请输入 1–${MAX_INPUT_LENGTH} 字符的问题。`);
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    const mapRevision = getMapRevision();
    setPending(question);
    setError("");
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 60_000);
    try {
      const history: ChatMessage[] = messages.slice(-MAX_HISTORY_MESSAGES).map(({ role, content }) => ({ role, content }));
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.getRandomValues(new Uint32Array(4)).join("-") },
        body: JSON.stringify({ version: "1.0", messages: [...history, { role: "user", content: question }], context: getChatContext() }),
        signal: controller.signal,
      });
      let data;
      try { data = await response.json(); }
      catch { throw new Error("聊天服务返回了异常响应，请稍后重试。"); }
      if (!response.ok) throw new Error(typeof data?.error?.message === "string" ? data.error.message : "请求失败，请稍后重试。");
      if (controller.signal.aborted || controllerRef.current !== controller) return;
      const parsed = ChatSuccessV1Schema.safeParse(data);
      if (!parsed.success) throw new Error("聊天协议或地图操作格式不符合约定，请刷新后重试。地图未更新。");
      data = parsed.data;
      const answerText = data.answerText && data.reply.startsWith(data.answerText) ? data.answerText : undefined;
      const caseReferences = data.caseReferences?.length && answerText ? data.caseReferences : undefined;
      const updated: DisplayMessage[] = [
        ...messages, { role: "user", content: question },
        { role: "assistant", content: data.reply, truncated: data.truncated,
          answerText: caseReferences ? answerText : undefined, caseReferences, caseLookup: data.caseLookup, noLocalCaseMatch: data.noLocalCaseMatch === true,
          toolEvents: data.toolEvents, mapActions: data.mapActions, mapRevision },
      ];
      if (updated.length > MAX_HISTORY_MESSAGES) setDiscardedMessages((count) => count + updated.length - MAX_HISTORY_MESSAGES);
      setMessages(updated.slice(-MAX_HISTORY_MESSAGES));
      setInput("");
    } catch (failure) {
      if (controllerRef.current !== controller) return;
      if (controller.signal.aborted) setError(timedOut ? "等待回答超时，请重试。问题已保留。" : "已停止等待，问题已保留，可重新发送。");
      else setError(failure instanceof TypeError ? "网络连接异常，请检查网络后重试。问题已保留。" : failure instanceof Error ? failure.message : "发送失败，请稍后重试。");
    } finally {
      clearTimeout(timeout);
      if (controllerRef.current === controller) { controllerRef.current = null; setPending(null); }
    }
  }

  return (
    <div className="chat-panel" data-empty={isEmpty}>
      <div className="chat-body">
        {isEmpty && <p className="chat-empty">你想了解哪个节气？</p>}
        <div className="chat-transcript" ref={transcriptRef} role="log" aria-label="节气聊天记录" aria-live="polite" aria-relevant="additions text" tabIndex={isEmpty ? undefined : 0}>
          {discardedMessages > 0 && <p className="chat-small">更早的对话已移出，仅保留最近 5 轮。</p>}
          {messages.map((message, index) => <article className={`chat-message chat-${message.role}`} key={discardedMessages + index} ref={index === messages.length - 1 ? latestAnswerRef : undefined}>
            <p className="chat-speaker">{message.role === "user" ? "你" : "四时助手"}</p>
            {Boolean(message.toolEvents?.length) && <ul className="chat-tool-events" aria-label="本轮实际执行的工具">{message.toolEvents!.map(event => <li key={event.toolCallId} data-tool={event.toolName} data-status={event.status}>
              {event.status === "success" ? "已" : "未能"}{TOOL_LABELS[event.toolName] ?? "执行工具"}{event.status === "error" && <span>{event.error.message}</span>}
            </li>)}</ul>}
            {message.toolEvents?.some(event => event.status === "error") && <p className="chat-map-notice">部分工具未完成，地图未更新。</p>}
            {!message.toolEvents?.length && message.caseLookup && message.caseLookup.matchedTitles.length > 0 && <details className="chat-case-lookup">
              <summary>已查询案例库 · 找到 {message.caseLookup.matchedTitles.length} 则</summary>
              <ul>{message.caseLookup.matchedTitles.map((title, index) => <li key={index}>{title}</li>)}</ul>
            </details>}
            <div className="chat-message-text">{message.role === "assistant" ? linkedText(message.answerText ?? message.content) : message.content}</div>
            {message.truncated && <p className="chat-small">回答已达到长度上限，可追问“请继续”。</p>}
            {message.caseReferences && <CaseReferences references={message.caseReferences} onShowOnMap={onShowOnMap} visitOrigin={visitOrigin} />}
            {Boolean(message.mapActions?.length) && <MapActionsPreview actions={message.mapActions!} expectedRevision={message.mapRevision!} currentRevision={revision} onApply={onApplyMapActions} />}
            {message.noLocalCaseMatch && <div className="chat-case-empty">
              <p>{message.caseLookup ? "已查询案例库，暂未找到匹配的已核验案例。" : "本站暂未找到匹配的已核验案例。"}</p>
              <button type="button" className="chat-case-map" onClick={() => onShowOnMap()}>浏览地图</button>
            </div>}
          </article>)}
          {busy && <><article className="chat-message chat-user"><p className="chat-speaker">你</p><div className="chat-message-text">{pending}</div></article><p className="chat-loading" role="status">正在分析问题，按需查询资料…</p></>}
        </div>
        <div className="chat-suggestions" role="group" aria-label="推荐问题">
          {SUGGESTIONS.map((suggestion) => (
            <button type="button" key={suggestion} disabled={busy} onClick={() => { setInput(suggestion); setError(""); inputRef.current?.focus(); }}>
              {suggestion}<span aria-hidden="true">＋</span>
            </button>
          ))}
        </div>
      </div>
      {error && <p className="chat-error" role="alert">{error}</p>}
      <form className="chat-form" onSubmit={send}>
        <label htmlFor={inputId}>提问</label>
        <div className="chat-composer">
          <div className="chat-input-sheet">
            <textarea ref={inputRef} id={inputId} value={input} onChange={(event) => setInput(event.target.value)} maxLength={MAX_INPUT_LENGTH} disabled={busy} rows={2} placeholder="写下你的节气疑问…" aria-describedby={`${inputId}-help ${inputId}-count`} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
            <span id={`${inputId}-count`} className="chat-count">{input.length} / {MAX_INPUT_LENGTH}</span>
          </div>
          {busy ? <button type="button" className="chat-send" onClick={() => controllerRef.current?.abort()}>停止<br />等待</button> : <button type="submit" className="chat-send" disabled={!input.trim()}>发送</button>}
        </div>
        <div className="chat-actions"><span className="chat-form-meta">Enter 发送 · Shift+Enter 换行</span><button type="button" className="chat-clear" disabled={!busy && messages.length === 0 && !error} onClick={() => { controllerRef.current?.abort(); controllerRef.current = null; invalidateMapRevision(); setPending(null); setMessages([]); setError(""); setDiscardedMessages(0); }}>清空对话</button></div>
        <p id={`${inputId}-help`} className="chat-small">刷新会清空对话。AI 回答请结合资料来源判断。</p>
      </form>
    </div>
  );
}
