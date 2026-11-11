"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import InkLandscape from "./InkLandscape";

const MotionContext = createContext<{ paused: boolean; toggle: () => void } | null>(null);
function subscribeReducedMotion(callback: () => void) {
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  preference.addEventListener("change", callback);
  return () => preference.removeEventListener("change", callback);
}
const readReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function ExploreMotionControl() {
  const motion = useContext(MotionContext);
  const reduced = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => false);
  if (!motion) return null;
  return <button type="button" className="explore-motion-control" aria-label="页面装饰动效" aria-pressed={!motion.paused && !reduced} disabled={reduced} onClick={motion.toggle} title="控制页面装饰动效；始终遵循系统减少动态效果设置">
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">{motion.paused ? <path d="m5 3 7 5-7 5Z" /> : <path d="M5 3v10M11 3v10" />}</svg>
    {reduced ? "已减少动效" : motion.paused ? "开启动效" : "暂停动效"}
  </button>;
}

const REVEAL_TARGETS = ".culture-map-sheet, .case-explorer";

export default function ExploreMotion({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const targets = Array.from(root.querySelectorAll<HTMLElement>(REVEAL_TARGETS));
    const revealed = new WeakSet<HTMLElement>();
    let observer: IntersectionObserver | undefined;

    function show(element: HTMLElement, immediate = false) {
      if (revealed.has(element) && element.dataset.exploreReveal === "instant") return;
      element.dataset.exploreReveal = immediate ? "instant" : "visible";
      revealed.add(element);
      observer?.unobserve(element);
    }

    function configure() {
      observer?.disconnect();
      if (preference.matches || !("IntersectionObserver" in window)) {
        targets.forEach(element => { delete element.dataset.exploreReveal; revealed.add(element); });
        return;
      }
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => { if (entry.isIntersecting) show(entry.target as HTMLElement); });
      }, { threshold: .04, rootMargin: "0px 0px -20px 0px" });
      targets.forEach(element => {
        if (revealed.has(element) || element.getBoundingClientRect().top < window.innerHeight) show(element);
        else { element.dataset.exploreReveal = "pending"; observer?.observe(element); }
      });
    }

    // Keyboard navigation and case-detail autofocus must never land in hidden content.
    function revealFocus(event: FocusEvent) {
      if (!(event.target instanceof Element)) return;
      const element = event.target.closest<HTMLElement>("[data-explore-reveal]");
      if (element && root?.contains(element)) show(element, true);
    }

    configure();
    root.addEventListener("focusin", revealFocus);
    preference.addEventListener("change", configure);
    return () => {
      observer?.disconnect();
      root.removeEventListener("focusin", revealFocus);
      preference.removeEventListener("change", configure);
      targets.forEach(element => { delete element.dataset.exploreReveal; });
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    function visibility() { root?.toggleAttribute("data-motion-paused", document.hidden || paused); }
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => { document.removeEventListener("visibilitychange", visibility); root?.removeAttribute("data-motion-paused"); };
  }, [paused]);

  // Keep this root untransformed: the floating chat is fixed to the viewport.
  return <MotionContext.Provider value={{ paused, toggle: () => setPaused(value => !value) }}><div className="explore-page" ref={rootRef}>
    <InkLandscape />
    <div className="explore-ambient" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <span key={index} />)}</div>
    {children}
  </div></MotionContext.Provider>;
}
