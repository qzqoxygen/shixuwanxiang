"use client";

import { useLayoutEffect, useRef } from "react";
import { SEASONS, SOLAR_TERMS } from "@/lib/solar-terms";
import { BOOK_TURN_DURATION } from "@/lib/book-turn-animation";

type Props = {
  bookId: string;
  currentIndex: number;
  requestedIndex: number;
  activeIndex: number;
  motion: boolean;
  duration?: number;
  onNavigate: (index: number) => void;
};

export default function BookDirectory({ bookId, currentIndex, requestedIndex, activeIndex, motion, duration = BOOK_TURN_DURATION, onNavigate }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const positioned = useRef(false);

  // A single marker follows the frozen destination of the actual paper, rather
  // than chasing queued clicks. Its geometry stays independent of book state.
  useLayoutEffect(() => {
    const grid = gridRef.current;
    const marker = markerRef.current;
    const button = grid?.querySelector<HTMLElement>(`button[data-term-id="${SOLAR_TERMS[activeIndex].id}"]`);
    if (!grid || !marker || !button) return;
    let lastGeometry = "";
    const position = (animate: boolean) => {
      const parent = grid.getBoundingClientRect();
      const target = button.getBoundingClientRect();
      if (!target.width || !target.height) return;
      const x = target.left - parent.left;
      const y = target.top - parent.top;
      const geometry = [x, y, target.width, target.height].join(",");
      if (!animate && geometry === lastGeometry) return;
      lastGeometry = geometry;
      const from = getComputedStyle(marker).transform;
      animationRef.current?.cancel();
      const to = `translate3d(${x}px, ${y}px, 0)`;
      marker.style.width = `${target.width}px`;
      marker.style.height = `${target.height}px`;
      marker.style.transform = to;
      marker.style.setProperty("--selection-accent", getComputedStyle(button).getPropertyValue("--directory-accent"));
      if (positioned.current && animate && !document.hidden && typeof marker.animate === "function" && from !== "none") {
        try {
          animationRef.current = marker.animate([{ transform: from }, { transform: to }], {
            duration, easing: "cubic-bezier(.45,.02,.25,1)",
          });
        } catch { animationRef.current = null; /* Keep navigation usable without this decoration. */ }
      }
      positioned.current = true;
      grid.dataset.indicatorReady = "true";
    };
    position(motion);
    const resized = () => position(false);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resized);
    observer?.observe(grid);
    observer?.observe(button);
    window.addEventListener("resize", resized);
    return () => { observer?.disconnect(); window.removeEventListener("resize", resized); };
  }, [activeIndex, motion, duration]);

  useLayoutEffect(() => () => { animationRef.current?.cancel(); }, []);
  const pending = currentIndex !== requestedIndex;
  const statusIndex = pending ? requestedIndex : currentIndex;
  return <nav className="book-directory" aria-label="二十四节气目录">
    <div className="book-directory-heading"><p>节气目录</p><span className="book-directory-status"><span key={`${pending}-${statusIndex}`}>{pending ? "待翻至" : "正在读"}：{SOLAR_TERMS[statusIndex].name}</span></span></div>
    <div className="book-directory-seasons" ref={gridRef} data-active-term={SOLAR_TERMS[activeIndex].id}>
      <span ref={markerRef} className="book-directory-selection" aria-hidden="true" />
      {SEASONS.map((season, seasonIndex) => <section className="book-directory-season" data-season={season.id} data-active={SOLAR_TERMS[activeIndex].season === season.id} key={season.id} aria-label={`${season.name}季节气`}>
        <button type="button" className="book-directory-season-entry seasons-book-button" aria-label={`${season.name}季：从${SOLAR_TERMS[seasonIndex * 6].name}开始`} aria-controls={bookId} onClick={() => onNavigate(seasonIndex * 6)}><strong>{season.name}</strong><span>{season.subtitle}</span><span aria-hidden="true">↗</span></button>
        <div className="book-directory-terms">
          {SOLAR_TERMS.slice(seasonIndex * 6, seasonIndex * 6 + 6).map((term, position) => {
            const index = seasonIndex * 6 + position;
            return <button type="button" className="seasons-book-button" key={term.id} data-term-id={term.id} data-highlighted={activeIndex === index} data-requested={pending && requestedIndex === index && requestedIndex !== activeIndex} aria-pressed={currentIndex === index} aria-controls={bookId} onClick={() => onNavigate(index)}><span className="book-directory-term-label">{term.name}</span><span className="seasons-sr-only">{pending && requestedIndex === index ? "，等待翻至" : ""}</span></button>;
          })}
        </div>
      </section>)}
    </div>
  </nav>;
}
