"use client";

import { useEffect, useRef, type ReactNode } from "react";

export default function HomeEditorialMotion({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const targets = root.querySelectorAll<HTMLElement>("[data-home-reveal]");
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) show(entry.target as HTMLElement);
      }
    }, { rootMargin: "0px 0px -28px", threshold: .12 });

    function show(target: HTMLElement, immediate = false) {
      target.dataset.homeReveal = immediate ? "instant" : "visible";
      observer.unobserve(target);
    }

    for (const target of targets) {
      if (target.getBoundingClientRect().top >= window.innerHeight) {
        target.dataset.homeReveal = "waiting";
        observer.observe(target);
      }
    }

    function revealFocus(event: FocusEvent) {
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest<HTMLElement>("[data-home-reveal='waiting']");
      if (target) show(target, true);
    }

    root.addEventListener("focusin", revealFocus);
    return () => {
      observer.disconnect();
      root.removeEventListener("focusin", revealFocus);
      for (const target of targets) target.dataset.homeReveal = "";
    };
  }, []);

  return <div className="home-editorial" ref={rootRef}>{children}</div>;
}
