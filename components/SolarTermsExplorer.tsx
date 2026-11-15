"use client";

import Link from "next/link";
import { useEffect, useId, useReducer, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from "react";
import { ReadingPage, PhotoPage } from "@/components/seasons/BookPages";
import BookDirectory from "@/components/seasons/BookDirectory";
import { useBookSwipe } from "@/components/seasons/useBookSwipe";
import { SOLAR_TERMS, type SolarTermId } from "@/lib/solar-terms";
import type { VisitQuery } from "@/lib/solar-visit";
import { visitHref } from "@/lib/visit-links";
import { SOLAR_TERM_PHOTOS } from "@/lib/solar-term-photos";
import { getSeasonGuide, type GuideCaseSources, type GuideMode } from "@/lib/season-guides";
import PhotoGuide from "@/components/seasons/PhotoGuide";

import { bookReducer, INITIAL_BOOK } from "@/lib/book-navigation";
import { BOOK_SLIDE_DURATION, BOOK_TURN_DURATION, startBookSlide, startBookTurn } from "@/lib/book-turn-animation";

function subscribeReducedMotion(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const readReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function subscribeCompact(callback: () => void) {
  const media = window.matchMedia("(max-width: 1000px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const readCompact = () => window.matchMedia("(max-width: 1000px)").matches;
const number = (value: number) => String(value).padStart(2, "0");

export default function SolarTermsExplorer({ caseSources, initialTerm, visitOrigin }: {
  caseSources: GuideCaseSources; initialTerm?: SolarTermId; visitOrigin?: VisitQuery;
}) {
  const [book, dispatch] = useReducer(bookReducer, initialTerm, term => {
    const index = term ? SOLAR_TERMS.findIndex(({ id }) => id === term) : INITIAL_BOOK.index;
    return { ...INITIAL_BOOK, index, requested: index };
  });
  const [paused, setPaused] = useState(false);
  const [guideMode, setGuideMode] = useState<GuideMode>("brief");
  const rootRef = useRef<HTMLDivElement>(null);
  const leafRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLElement>(null);
  const warmedImages = useRef(new Set<string>());
  const reduced = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => false);
  const compact = useSyncExternalStore(subscribeCompact, readCompact, () => false);
  const still = paused || reduced;
  const id = useId();
  const settledIndex = still ? book.requested : book.index;
  const selected = SOLAR_TERMS[settledIndex];
  const turn = still ? null : book.turn;
  const leftIndex = compact ? turn?.from ?? settledIndex : turn?.direction === -1 ? turn.to : turn?.from ?? settledIndex;
  const rightIndex = compact ? turn?.from ?? settledIndex : turn?.direction === 1 ? turn.to : turn?.from ?? settledIndex;
  const duration = compact ? BOOK_SLIDE_DURATION : BOOK_TURN_DURATION;
  const swipeHandlers = useBookSwipe(delta => navigate(delta, "step"));
  const previous = SOLAR_TERMS[Math.max(0, book.requested - 1)];
  const next = SOLAR_TERMS[Math.min(23, book.requested + 1)];

  useEffect(() => {
    const root = rootRef.current;
    function visibility() {
      root?.toggleAttribute("data-page-hidden", document.hidden);
      if (document.hidden) dispatch({ type: "settle" });
    }
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);

  useEffect(() => {
    const activeTurn = book.turn;
    if (!activeTurn) return;
    const start = compact ? startBookSlide : startBookTurn;
    return start(still ? null : compact ? trackRef.current : leafRef.current, activeTurn.direction, {
      complete: () => dispatch({ type: "complete", serial: activeTurn.serial }),
      recover: () => dispatch({ type: "recover", serial: activeTurn.serial }),
    });
  }, [book.turn, still, compact]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let previous = stage.getBoundingClientRect();
    const resized = () => {
      const next = stage.getBoundingClientRect();
      if (Math.abs(next.width - previous.width) > 1 || (!compact && Math.abs(next.height - previous.height) > 1)) dispatch({ type: "settle" });
      previous = next;
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resized);
    observer?.observe(stage);
    const windowResized = () => { dispatch({ type: "settle" }); resized(); };
    window.addEventListener("resize", windowResized);
    return () => { observer?.disconnect(); window.removeEventListener("resize", windowResized); };
  }, [compact]);

  useEffect(() => { dispatch({ type: "settle" }); }, [compact]);

  useEffect(() => {
    for (const index of [book.requested - 1, book.requested, book.requested + 1]) {
      const term = SOLAR_TERMS[index];
      if (!term) continue;
      const src = SOLAR_TERM_PHOTOS[term.id].src;
      if (warmedImages.current.has(src)) continue;
      warmedImages.current.add(src);
      const image = new window.Image();
      image.decoding = "async";
      image.src = src;
    }
  }, [book.requested]);

  function navigate(value: number, mode: "go" | "step" = "go", instant = false) {
    const bookElement = bookRef.current;
    if (bookElement?.querySelector(".seasons-book-base")?.contains(document.activeElement)) bookElement.focus({ preventScroll: true });
    const animate = !still && !instant;
    dispatch(mode === "step" ? { type: "step", delta: value, animate } : { type: "go", index: value, animate });
  }
  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || (event.target as HTMLElement).closest("input,textarea,select,[contenteditable]")) return;
    if (event.key === "ArrowRight") { event.preventDefault(); navigate(1, "step"); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); navigate(-1, "step"); }
    else if ((event.key === "Home" || event.key === "End") && event.target === event.currentTarget) { event.preventDefault(); navigate(event.key === "Home" ? 0 : 23, "go", true); }
  }
  const controls = <div className="seasons-book-controls">
    <button type="button" className="seasons-book-previous seasons-book-button" disabled={book.requested === 0} onClick={() => navigate(-1, "step")} aria-label={book.requested === 0 ? "已是第一页" : `上一节气：${previous.name}`}><span><small>上一节气</small>{book.requested === 0 ? "卷首" : previous.name}</span></button>
    <div className="seasons-book-position"><span>{number(settledIndex + 1)}<i> / 24</i></span><p id={`${id}-book-hint`}>{turn ? <>正在翻至{SOLAR_TERMS[turn.to].name}{book.requested !== turn.to && <>，随后前往{SOLAR_TERMS[book.requested].name}</>}</> : compact ? "左滑下一节气 · 右滑上一节气" : "滑动照片或用方向键翻页"}</p></div>
    <button type="button" className="seasons-book-next seasons-book-button" disabled={book.requested === 23} onClick={() => navigate(1, "step")} aria-label={book.requested === 23 ? "已是最后一页" : `下一节气：${next.name}`}><span><small>下一节气</small>{book.requested === 23 ? "卷末" : next.name}</span></button>
  </div>;
  const directory = <BookDirectory bookId={`${id}-book`} currentIndex={settledIndex} requestedIndex={book.requested} activeIndex={turn?.to ?? settledIndex} motion={!still} duration={duration} onNavigate={index => { navigate(index); if (compact) { bookRef.current?.focus({ preventScroll: true }); bookRef.current?.scrollIntoView({ behavior: still ? "instant" : "smooth", block: "start" }); } }} />;
  function photo(index: number, key: string, interactive = false) {
    const termId = SOLAR_TERMS[index].id;
    const guide = getSeasonGuide(termId)[guideMode];
    return <PhotoPage key={key} index={index} guide={<PhotoGuide
      termId={termId} mode={guideMode} intro={guide.intro} source={caseSources[termId]}
      interactive={interactive} onModeChange={setGuideMode}
    />} />;
  }

  return <div className="seasons-explorer" ref={rootRef} data-season={selected.season} data-still={still}>
    <div className="seasons-book-toolbar">
      <div>
        <h2 id={`${id}-book-title`} className="seasons-book-wordmark" aria-label="四时风物册">
          <span aria-hidden="true">四</span>
          <span aria-hidden="true">时</span>
          <span aria-hidden="true">风</span>
          <span aria-hidden="true">物</span>
          <span aria-hidden="true">册</span>
        </h2>
        <p>翻阅节气风物，点「AI 再讲一点」获取补充讲解。</p>
      </div>
      <svg className="seasons-toolbar-art" viewBox="0 0 260 56" aria-hidden="true" focusable="false">
        <image href="/images/studio-stickers/distant-mountains.webp" x="2" y="-46" width="144" height="144" opacity=".63" />
        <g className="seasons-toolbar-ripples" fill="none" stroke="#72938b" strokeLinecap="round">
          <path d="M44 43q35 1 63-2m52 6q29 1 49-2" strokeWidth=".85" />
          <path d="M106 50q16 1 34-1m76-10 19-1" strokeWidth=".65" />
        </g>
        <image className="seasons-toolbar-boat" href="/images/studio-stickers/small-wooden-boat.webp" x="112" y="7" width="57" height="57" />
        <image className="seasons-toolbar-willow" href="/images/studio-stickers/willow.webp" x="193" y="0" width="58" height="58" opacity=".84" />
        <path className="seasons-toolbar-leaf" d="M185 25q-6-1-9-5 7 0 9 5Z" fill="#7e916b" />
      </svg>
      <div className="seasons-book-toolbar-actions"><button type="button" className="seasons-motion seasons-book-button" aria-pressed={!still} disabled={reduced} onClick={() => { setPaused(value => !value); dispatch({ type: "settle" }); }} aria-label="页面动效"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">{still ? <path d="m5 3 7 5-7 5Z" /> : <path d="M5 3v10M11 3v10" />}</svg><span>{reduced ? "已减少动效" : paused ? "开启动效" : "暂停动效"}</span></button></div>
    </div>
    <div className="seasons-visit-link">
      {visitOrigin && <Link className="text-link" prefetch={false} href={visitHref(visitOrigin)}>返回节气探访</Link>}
      {visitOrigin?.solarTermId !== selected.id &&
        <Link className="text-link" prefetch={false} href={visitHref({ ...visitOrigin, solarTermId: selected.id })}>去探访{selected.name}风物</Link>}
    </div>
    <div className="seasons-reading-layout">
    {!compact && directory}
    <section id={`${id}-book`} className="seasons-book" ref={bookRef} tabIndex={0} role="region" aria-roledescription={compact ? "节气阅读册" : "翻页书"} aria-labelledby={`${id}-book-title`} aria-describedby={`${id}-book-hint`} onKeyDown={keyboard} style={{ "--book-turn-duration": `${duration}ms` } as CSSProperties} data-layout={compact ? "single" : "spread"} data-term-id={selected.id} data-requested-term-id={SOLAR_TERMS[book.requested].id} data-turning={Boolean(book.turn)} data-turn-direction={turn?.direction}>
      <p className="seasons-book-small-screen-hint">左右滑动切换节气，点照片看大图。</p>
      {compact && controls}
      <div className="seasons-book-viewport" {...swipeHandlers}><div className="seasons-book-cover">
        <div className="seasons-book-stage" ref={stageRef}>
          <div key={compact ? turn?.serial ?? `idle-${settledIndex}` : "spread"} className="seasons-book-track" ref={trackRef}>
          <div className="seasons-book-base" aria-hidden={Boolean(turn)} inert={Boolean(turn)} aria-busy={Boolean(book.turn)}><ReadingPage index={leftIndex} titleId={`${id}-term-title`} />{photo(rightIndex, `base-${rightIndex}`, !turn)}</div>
          {compact && turn && <div className="seasons-book-mobile-incoming" data-direction={turn.direction === 1 ? "next" : "previous"} aria-hidden="true" inert><ReadingPage index={turn.to} />{photo(turn.to, `incoming-${turn.to}`)}</div>}
          </div>
          {!compact && turn && <span key={`shadow-${turn.serial}`} className="seasons-book-turn-shadow" data-direction={turn.direction === 1 ? "next" : "previous"} aria-hidden="true" />}
          {!compact && <span className="seasons-book-spine" aria-hidden="true" />}
          {!compact && turn && <div key={turn.serial} className="seasons-book-leaf" data-direction={turn.direction === 1 ? "next" : "previous"} ref={leafRef} aria-hidden="true" inert>
            <div className="seasons-book-leaf-face seasons-book-leaf-front">{turn.direction === 1 ? photo(turn.from, `front-${turn.from}`) : <ReadingPage index={turn.from} />}</div>
            <div className="seasons-book-leaf-face seasons-book-leaf-back">{turn.direction === 1 ? <ReadingPage index={turn.to} /> : photo(turn.to, `back-${turn.to}`)}</div>
          </div>}
        </div>
      </div>
      </div>
      {!compact && controls}
    </section>
    {compact && directory}
    </div>
    <p className="seasons-announcement" role="status" aria-live="polite" aria-atomic="true">第{settledIndex + 1}个节气，{selected.name}。{compact ? "本页依次为节气介绍与对应照片。" : "左页为节气介绍，右页为对应照片。"}{selected.description}</p>
  </div>;
}
