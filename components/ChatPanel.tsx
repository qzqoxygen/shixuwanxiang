"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { MAX_ASSISTANT_LENGTH, MAX_HISTORY_MESSAGES, MAX_INPUT_LENGTH, type ChatMessage } from "@/lib/chat";
import { ChatCaseLookupSchema, ChatCaseReferencesSchema, type ChatCaseLookup, type ChatCaseReference } from "@/lib/contracts/cultural-case";
import { SOLAR_TERMS } from "@/lib/solar-terms";
import { studioCaseHref } from "@/lib/studio-inspiration";
import "./ChatPanel.css";

type DisplayMessage = ChatMessage & {
  truncated?: boolean;
  answerText?: string;
  caseReferences?: ChatCaseReference[];
  caseLookup?: ChatCaseLookup;
  noLocalCaseMatch?: boolean;
};
const SUGGESTIONS = ["江苏和浙江的冬至习俗有什么不同？", "广东秋分有什么习俗？", "什么是冬至？"];

function linkedText(content: string) {
  return content.split(/(https?:\/\/[^\s<>]+)/gu).map((part, index) =>
    /^https?:\/\//u.test(part)
      ? <a key={index} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
      : part);
}

function CaseReferences({ references, onShowOnMap }: { references: ChatCaseReference[]; onShowOnMap: (reference: ChatCaseReference) => void }) {
  return <div className="chat-case-references">
    <p className="chat-case-heading">已核验文化案例</p>
    <ul className="chat-case-list">
      {references.map((reference) => {
        const termName = SOLAR_TERMS.find(({ id }) => id === reference.solarTermId)?.name;
        const place = [...new Set([reference.provinceName, reference.regionName])].join(" · ");
        const [primarySource, ...otherSources] = reference.sources;
        return <li className="chat-case-card" key={reference.caseId}>
          <span className="chat-case-caption">案例 {reference.citation} · {termName}</span>
          <strong>{reference.title}</strong>
          <p className="chat-case-place">{place}</p>
          <div className="chat-case-actions">
            <button type="button" className="chat-case-map" aria-label={`在地图上查看：${reference.title}`} onClick={() => onShowOnMap(reference)}>
              在地图上查看 <span aria-hidden="true">→</span>
            </button>
            <a className="chat-case-original" href={primarySource.url} target="_blank" rel="noopener noreferrer" aria-label={`查看原文：${primarySource.title}`} title={primarySource.title}>
              查看原文 <span aria-hidden="true">↗</span>
            </a>
            <Link className="chat-case-create" href={studioCaseHref(reference)} prefetch={false} aria-label={`用这个案例做节气卡：${reference.title}`}>
              做节气卡 <span aria-hidden="true">→</span>
            </Link>
          </div>
          {primarySource.accessNote && <span className="chat-case-source-note">{primarySource.accessNote}</span>}
          {otherSources.length > 0 && <ul className="chat-case-sources">
            {otherSources.map((source) => <li key={source.url}>
              <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} <span aria-hidden="true">↗</span></a>
              {source.accessNote && <span className="chat-case-source-note">{source.accessNote}</span>}
            </li>)}
          </ul>}
        </li>;
      })}
    </ul>
  </div>;
}

export default function ChatPanel({ onShowOnMap }: { onShowOnMap: (reference?: ChatCaseReference) => void }) {
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

  useEffect(() => () => controllerRef.current?.abort(), []);
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
    setPending(question);
    setError("");
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 60_000);
    try {
      const history: ChatMessage[] = messages.slice(-MAX_HISTORY_MESSAGES).map(({ role, content }) => ({ role, content }));
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.getRandomValues(new Uint32Array(4)).join("-") },
        body: JSON.stringify({ messages: [...history, { role: "user", content: question }] }),
        signal: controller.signal,
      });
      let data;
      try { data = await response.json(); }
      catch { throw new Error("聊天服务返回了异常响应，请稍后重试。"); }
      if (!response.ok) throw new Error(typeof data?.error?.message === "string" ? data.error.message : "请求失败，请稍后重试。");
      if (typeof data?.answer !== "string" || !data.answer.trim() || data.answer.length > MAX_ASSISTANT_LENGTH) throw new Error("未收到有效回答，请重试。");
      const parsed = ChatCaseReferencesSchema.safeParse(data.caseReferences);
      const lookup = ChatCaseLookupSchema.safeParse(data.caseLookup);
      const answerText = typeof data.answerText === "string" && data.answerText.trim() && data.answer.startsWith(data.answerText) ? data.answerText : undefined;
      const caseReferences = parsed.success && parsed.data.length && answerText ? parsed.data : undefined;
      const updated: DisplayMessage[] = [
        ...messages, { role: "user", content: question },
        { role: "assistant", content: data.answer, truncated: data.truncated === true,
          answerText: caseReferences ? answerText : undefined, caseReferences, caseLookup: lookup.data, noLocalCaseMatch: data.noLocalCaseMatch === true },
      ];
      if (updated.length > MAX_HISTORY_MESSAGES) setDiscardedMessages((count) => count + updated.length - MAX_HISTORY_MESSAGES);
      setMessages(updated.slice(-MAX_HISTORY_MESSAGES));
      setInput("");
    } catch (failure) {
      if (controller.signal.aborted) setError(timedOut ? "等待回答超时，请重试。问题已保留。" : "已停止等待，问题已保留，可重新发送。");
      else setError(failure instanceof TypeError ? "网络连接异常，请检查网络后重试。问题已保留。" : failure instanceof Error ? failure.message : "发送失败，请稍后重试。");
    } finally {
      clearTimeout(timeout);
      controllerRef.current = null;
      setPending(null);
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
            {message.caseLookup && message.caseLookup.matchedTitles.length > 0 && <details className="chat-case-lookup">
              <summary>已查询案例库 · 找到 {message.caseLookup.matchedTitles.length} 则</summary>
              <ul>{message.caseLookup.matchedTitles.map((title, index) => <li key={index}>{title}</li>)}</ul>
            </details>}
            <div className="chat-message-text">{message.role === "assistant" ? linkedText(message.answerText ?? message.content) : message.content}</div>
            {message.truncated && <p className="chat-small">回答已达到长度上限，可追问“请继续”。</p>}
            {message.caseReferences && <CaseReferences references={message.caseReferences} onShowOnMap={onShowOnMap} />}
            {message.noLocalCaseMatch && <div className="chat-case-empty">
              <p>{message.caseLookup ? "已查询案例库，暂未找到匹配的已核验案例。" : "本站暂未找到匹配的已核验案例。"}</p>
              <button type="button" className="chat-case-map" onClick={() => onShowOnMap()}>浏览地图 <span aria-hidden="true">→</span></button>
            </div>}
          </article>)}
          {busy && <><article className="chat-message chat-user"><p className="chat-speaker">你</p><div className="chat-message-text">{pending}</div></article><p className="chat-loading" role="status">正在整理回答…</p></>}
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
        <div className="chat-actions"><span className="chat-form-meta">Enter 发送 · Shift+Enter 换行</span><button type="button" className="chat-clear" disabled={busy || (messages.length === 0 && !error)} onClick={() => { setMessages([]); setError(""); setDiscardedMessages(0); }}>清空对话</button></div>
        <p id={`${inputId}-help`} className="chat-small">刷新会清空对话。AI 回答请结合资料来源判断。</p>
      </form>
    </div>
  );
}
