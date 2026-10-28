"use client";

import { useState } from "react";
import Link from "next/link";
import { SEASONS, SOLAR_TERMS } from "@/lib/solar-terms";

export default function SolarTermsExplorer() {
  const [selectedId, setSelectedId] = useState("qingming");
  const selected = SOLAR_TERMS.find((term) => term.id === selectedId)!;
  function selectTerm(id: string) {
    setSelectedId(id);
    // On a narrow screen the detail follows all four groups; bring it into view.
    if (window.matchMedia("(max-width: 1000px)").matches) {
      document.getElementById("term-detail")?.scrollIntoView({ block: "start" });
    }
  }
  return <div className="terms-layout">
    <div className="season-groups">{SEASONS.map((season) => <section className={`season-group tone-${season.id}`} key={season.id} aria-labelledby={`season-${season.id}`}>
      <header><h2 id={`season-${season.id}`}>{season.name}</h2><p>{season.subtitle}</p><span>06</span></header>
      <div className="term-grid">{SOLAR_TERMS.filter((term) => term.season === season.id).map((term) =>
        <button type="button" key={term.id} aria-pressed={selectedId === term.id} aria-controls="term-detail" onClick={() => selectTerm(term.id)}>
          <span>{term.name}</span><small>{term.isFeatured ? "重点节气" : `${term.solarLongitude}°`}</small>
        </button>)}</div>
    </section>)}</div>
    <section id="term-detail" className={`paper-card term-detail tone-${selected.season}`} aria-labelledby="term-title" aria-live="polite" aria-atomic="true">
      <p className="eyebrow">节气手记 · {String(SOLAR_TERMS.indexOf(selected) + 1).padStart(2, "0")} / 24</p>
      {selected.isFeatured && <span className="status-label featured-label">重点节气</span>}
      <h2 id="term-title">{selected.name}</h2><p className="term-meta">{SEASONS.find((s) => s.id === selected.season)?.name}季 · 太阳黄经 {selected.solarLongitude}°</p>
      <p className="term-description">{selected.description}</p><div className="term-note">太阳在黄道上的视位置每推进15°，对应一个节气。这里展示基础知识，地域文化案例将逐步整理。</div>
      <Link className="ink-link" href="/explore">去知时，继续提问 ↗</Link>
    </section>
  </div>;
}
