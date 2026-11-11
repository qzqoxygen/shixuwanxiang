"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { MAX_ASSISTANT_LENGTH, MAX_HISTORY_MESSAGES, MAX_INPUT_LENGTH, type ChatMessage } from "@/lib/chat";
import "./ChatPanel.css";

type DisplayMessage = ChatMessage & { truncated?: boolean };
const SUGGESTIONS = ["广东秋分有什么习俗？", "什么是冬至？", "夏至为什么不一定最热？"];

function linkedText(content: string) {
  return content.split(/(https?:\/\/[^\s<>]+)/gu).map((part, index) =>
    /^https?:\/\//u.test(part)
      ? <a key={index} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
      : part);
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [discardedMessages, setDiscardedMessages] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputId = useId();
  const busy = pending !== null;

  useEffect(() => () => controllerRef.current?.abort(), []);
  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
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
      const updated: DisplayMessage[] = [
        ...messages, { role: "user", content: question },
        { role: "assistant", content: data.answer, truncated: data.truncated === true },
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
    <section className="chat-panel" aria-labelledby={`${inputId}-heading`}>
      <header className="chat-heading">
        <div><p className="eyebrow">问四时 · 知所以</p><h2 id={`${inputId}-heading`}>AI 文化讲解员</h2></div>
        <span className="chat-seal" aria-hidden="true">四时<br />问答</span>
      </header>
      <p className="chat-intro">DeepSeek AI · 节气与地方风物</p>
      <div className="chat-transcript" ref={transcriptRef} role="log" aria-label="节气聊天记录" aria-live="polite" aria-relevant="additions text" tabIndex={0}>
        {messages.length === 0 && !busy && <div className="chat-empty"><p>试试下方的问题，或直接提问。</p></div>}
        {discardedMessages > 0 && <p className="chat-small">更早的对话已移出，仅保留最近 5 轮。</p>}
        {messages.map((message, index) => <article className={`chat-message chat-${message.role}`} key={discardedMessages + index}>
          <p className="chat-speaker">{message.role === "user" ? "你" : "DeepSeek · 节气讲解"}</p>
          <div className="chat-message-text">{message.role === "assistant" ? linkedText(message.content) : message.content}</div>
          {message.truncated && <p className="chat-small">回答已达到长度上限，可追问“请继续”。</p>}
        </article>)}
        {busy && <><article className="chat-message chat-user"><p className="chat-speaker">你</p><div className="chat-message-text">{pending}</div></article><p className="chat-loading" role="status">正在等待 DeepSeek 回答…</p></>}
      </div>
      {error && <p className="chat-error" role="alert">{error}</p>}
      <div className="chat-suggestions" aria-label="推荐问题">{SUGGESTIONS.map((suggestion) => <button type="button" key={suggestion} disabled={busy} onClick={() => { setInput(suggestion); setError(""); inputRef.current?.focus(); }}>{suggestion}</button>)}</div>
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
    </section>
  );
}
