"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import type { ChatCaseReference } from "@/lib/contracts/cultural-case";
import type { MapAction } from "@/lib/contracts/chat-api";
import ChatPanel from "./ChatPanel";
import { useProvinces } from "./cultural-map/ProvinceInteraction";
import "./FloatingChat.css";

type Point = { x: number; y: number };
type Drag = Point & { pointerId: number; origin: Point; moved: boolean };
const EDGE = 16;

function keepOnScreen(point: Point, panel: HTMLElement): Point {
  const { width, height } = panel.getBoundingClientRect();
  return {
    x: Math.max(EDGE, Math.min(point.x, document.documentElement.clientWidth - width - EDGE)),
    y: Math.max(EDGE, Math.min(point.y, document.documentElement.clientHeight - height - EDGE)),
  };
}

function useFloatingPosition<T extends HTMLElement>(elementRef: RefObject<T | null>, active: boolean) {
  const [position, setPosition] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<Drag | null>(null);
  const blockClickRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    function resize() {
      const element = elementRef.current;
      if (!element || element.hidden) return;
      setPosition(previous => {
        if (!previous) return null;
        const fitted = keepOnScreen(previous, element);
        return fitted.x === previous.x && fitted.y === previous.y ? previous : fitted;
      });
    }
    const frame = requestAnimationFrame(resize);
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); };
  }, [active, elementRef]);

  function startDrag(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0 || event.isPrimary === false) return;
    const element = elementRef.current;
    if (!element) return;
    const { left, top } = element.getBoundingClientRect();
    blockClickRef.current = false;
    dragRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, origin: { x: left, y: top }, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    const element = elementRef.current;
    if (!drag || !element || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    if (!drag.moved) { drag.moved = true; blockClickRef.current = true; setDragging(true); }
    setPosition(keepOnScreen({ x: drag.origin.x + dx, y: drag.origin.y + dy }, element));
  }

  function endDrag(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    blockClickRef.current = drag.moved && event.type === "pointerup";
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    // A drag can synthesize a click. Ignore only that click, not the next tap.
    requestAnimationFrame(() => { blockClickRef.current = false; });
  }

  function lostCapture() {
    if (!dragRef.current) return;
    dragRef.current = null;
    blockClickRef.current = false;
    setDragging(false);
  }

  function moveWithKeys(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Home") { event.preventDefault(); setPosition(null); return; }
    const steps: Record<string, Point> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
    const direction = steps[event.key];
    const element = elementRef.current;
    if (!direction || !element) return;
    event.preventDefault();
    const { left, top } = element.getBoundingClientRect();
    const step = event.shiftKey ? 48 : 16;
    setPosition(keepOnScreen({ x: left + direction.x * step, y: top + direction.y * step }, element));
  }

  return {
    position, setPosition, dragging, moveWithKeys,
    ignoreClick: () => blockClickRef.current,
    style: position ? { left: position.x, top: position.y, right: "auto", bottom: "auto" } : undefined,
    pointerHandlers: { onPointerDown: startDrag, onPointerMove: moveDrag, onPointerUp: endDrag, onPointerCancel: endDrag, onLostPointerCapture: lostCapture },
  };
}

export default function FloatingChat() {
  const { dispatch, applyAiMapActions, setHovered, setFocused } = useProvinces();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const anchorRef = useRef<DOMRect | null>(null);
  const launcher = useFloatingPosition(launcherRef, !open);
  const { setPosition: setPanelPosition, ...panel } = useFloatingPosition(panelRef, open);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const element = panelRef.current;
      const anchor = anchorRef.current;
      if (element && anchor) {
        const { width, height } = element.getBoundingClientRect();
        setPanelPosition(previous => previous ?? keepOnScreen({ x: anchor.right - width, y: anchor.top - height - 12 }, element));
      }
      const input = element?.querySelector<HTMLTextAreaElement>("textarea:not(:disabled)");
      (input ?? element)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, setPanelPosition]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => launcherRef.current?.focus({ preventScroll: true }));
  }

  function showOnMap(reference?: ChatCaseReference) {
    if (reference) {
      const { caseId, solarTermId, provinceCode } = reference;
      setHovered(null);
      setFocused(null);
      dispatch({ type: "locate", caseId, solarTermId, provinceCode });
    }
    setOpen(false);
    requestAnimationFrame(() => document.getElementById(reference ? "case-detail-title" : "culture-map-heading")?.focus());
  }

  async function applyMapActions(actions: MapAction[], revision: number, signal: AbortSignal) {
    await applyAiMapActions(actions, revision, signal);
    setHovered(null);
    setFocused(null);
    setOpen(false);
    requestAnimationFrame(() => {
      const heading = document.getElementById(actions.some(action => action.type === "OPEN_CULTURAL_CASE") ? "case-detail-title" : "culture-map-heading");
      heading?.focus();
      heading?.scrollIntoView({ block: "nearest", behavior: "instant" });
    });
  }

  return <>
    <button type="button" className="cloud-chat-launcher" ref={launcherRef} hidden={open} aria-label="打开问四时 AI 助手" aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-window`} title="点击问答，拖动云朵可移动；方向键移动，Home 复位" data-dragging={launcher.dragging} style={launcher.style} {...launcher.pointerHandlers} onKeyDown={launcher.moveWithKeys} onClick={event => { if (launcher.ignoreClick()) { event.preventDefault(); return; } anchorRef.current = launcher.position ? event.currentTarget.getBoundingClientRect() : null; setOpen(true); }}>
      <span className="cloud-chat-launcher-art">
        <svg viewBox="0 0 190 116" aria-hidden="true">
          <defs><linearGradient id={`${id}-cloud-wash`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fbfcf3" /><stop offset=".55" stopColor="#e0ede2" /><stop offset="1" stopColor="#b4d1c5" /></linearGradient></defs>
          <path className="cloud-chat-cloud-back" d="M18 78C6 66 16 46 33 48C28 28 51 18 68 29C77 9 101 12 112 28C130 16 153 29 149 48C171 42 187 60 177 77C188 92 161 104 142 95C118 103 100 94 79 99C54 104 31 93 18 78Z" />
          <path className="cloud-chat-cloud" fill={`url(#${id}-cloud-wash)`} d="M34 79C18 80 12 65 23 56C32 48 43 52 46 58C38 41 52 28 68 34C73 14 99 18 105 33C126 21 145 34 139 51C159 45 174 58 165 72C182 86 159 97 141 89C120 97 103 88 84 92C63 98 44 87 34 79Z" />
          <g className="cloud-chat-cloud-line"><path d="M4 81C29 68 36 100 68 94S104 80 128 91S168 104 186 87M22 68C26 59 41 66 34 73C29 79 20 72 27 69M145 57C154 50 165 62 156 68C150 72 144 65 150 62" /><path className="cloud-chat-cloud-thread" d="M28 99C61 111 93 96 115 102S159 111 177 101M45 29C53 24 59 26 62 28M114 18C130 13 145 24 144 33" /></g>
          <g className="cloud-chat-cloud-spark"><path d="M154 26v7m-3.5-3.5h7M32 35v5m-2.5-2.5h5" /><circle cx="166" cy="43" r="1.2" /></g>
        </svg>
        <span className="cloud-chat-launcher-label">问四时<small>点击问答 · 拖动随行</small></span>
      </span>
    </button>
    {/* Hiding, rather than unmounting, retains the conversation and any draft. */}
    <div className="cloud-chat-window" id={`${id}-window`} ref={panelRef} hidden={!open} role="dialog" aria-modal="false" aria-labelledby={`${id}-title`} tabIndex={-1} data-dragging={panel.dragging} style={panel.style} onKeyDown={event => { if (event.key === "Escape" && !event.nativeEvent.isComposing) { event.stopPropagation(); close(); } }}>
      <header className="cloud-chat-header" {...panel.pointerHandlers} onPointerDown={event => { const button = (event.target as Element).closest("button"); if (!button || button.classList.contains("cloud-chat-grip")) panel.pointerHandlers.onPointerDown(event); }}>
        <button type="button" className="cloud-chat-grip" aria-label="移动聊天窗口，方向键调整位置" title="拖动标题栏，或用方向键移动" onKeyDown={panel.moveWithKeys}><svg width="14" height="22" viewBox="0 0 14 22" aria-hidden="true">{[5, 11, 17].map(y => <g key={y}><circle cx="4" cy={y} r="1.3" /><circle cx="10" cy={y} r="1.3" /></g>)}</svg></button>
        <div className="cloud-chat-title">
          <h2 id={`${id}-title`}>云间问四时</h2>
          <p>DeepSeek AI · 节气与地方风物</p>
        </div>
        <div className="cloud-chat-tools"><button type="button" className="cloud-chat-reset" aria-label="恢复聊天窗口位置" title="恢复位置" onClick={() => setPanelPosition(null)}>复位</button><button type="button" className="cloud-chat-minimize" aria-label="收起 AI 助手" title="收起，保留对话" onClick={close}>收起</button></div>
      </header>
      <div className="cloud-chat-content"><ChatPanel onShowOnMap={showOnMap} onApplyMapActions={applyMapActions} /></div>
    </div>
  </>;
}
