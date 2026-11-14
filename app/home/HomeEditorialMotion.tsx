"use client";

import { useEffect, useRef, type ReactNode } from "react";

export default function HomeEditorialMotion({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !("IntersectionObserver" in window)) return;

    const targets = root.querySelectorAll<HTMLElement>("[data-home-reveal]");
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const target = entry.target as HTMLElement;
        target.dataset.homeReveal = entry.isIntersecting ? "visible" : "waiting";
      }
    }, { rootMargin: "-48px 0px -72px" });

    for (const target of targets) {
      const bounds = target.getBoundingClientRect();
      if (bounds.top >= window.innerHeight || bounds.bottom <= 0) target.dataset.homeReveal = "waiting";
      observer.observe(target);
    }

    return () => {
      observer.disconnect();
      for (const target of targets) target.dataset.homeReveal = "";
    };
  }, []);

  return <div className="home-editorial" ref={rootRef}>{children}</div>;
}
