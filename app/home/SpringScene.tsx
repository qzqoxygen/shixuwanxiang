"use client";

import Image from "next/image";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import AutumnPond from "./AutumnPond";
import { chapters, gardenSeasons, type GardenSeason } from "./garden-seasons";
import SpringPond from "./SpringPond";
import SummerPond from "./SummerPond";
import WinterPond from "./WinterPond";

export default function SpringScene() {
  const [season, setSeason] = useState<GardenSeason>("spring");
  const [near, setNear] = useState(false);
  const [loadError, setLoadError] = useState("");
  const sceneRef = useRef<HTMLDivElement>(null);
  const viewButtonRef = useRef<HTMLButtonElement>(null);
  const selection = useRef(0);
  const chapter = chapters[season];

  function moveLayers(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    const stage = event.currentTarget;
    const { left, top, width, height } = stage.getBoundingClientRect();
    stage.style.setProperty("--spring-x", `${((event.clientX - left) / width - 0.5) * 36}px`);
    stage.style.setProperty("--spring-y", `${((event.clientY - top) / height - 0.5) * 24}px`);
  }

  function resetLayers(event: PointerEvent<HTMLDivElement>) {
    if (!near) clearOffset(event.currentTarget);
  }

  function clearOffset(stage: HTMLDivElement | null) {
    stage?.style.removeProperty("--spring-x");
    stage?.style.removeProperty("--spring-y");
  }

  function changeView() {
    clearOffset(sceneRef.current);
    setNear((current) => !current);
  }

  function returnOnEscape(event: KeyboardEvent<HTMLDivElement>) {
    if (!near || event.key !== "Escape") return;
    changeView();
    viewButtonRef.current?.focus({ preventScroll: true });
  }

  async function selectSeason(next: GardenSeason) {
    const request = ++selection.current;
    setLoadError("");
    if (next === season) return;

    const stage = sceneRef.current;
    if (!stage) return;
    const layers = stage.querySelectorAll<HTMLImageElement>(`[data-chapter="${next}"] img`);
    try {
      await Promise.all(Array.from(layers, (image) => image.decode()));
      if (stage.isConnected && request === selection.current) setSeason(next);
    } catch {
      if (stage.isConnected && request === selection.current) setLoadError("这一季的画面暂时无法加载。");
    }
  }

  return (
    <div
      ref={sceneRef}
      className="spring-stage"
      data-season={season}
      data-view={near ? "near" : "window"}
      onPointerMove={moveLayers}
      onPointerLeave={resetLayers}
      onPointerCancel={resetLayers}
      onKeyDown={returnOnEscape}
    >
      <div className="spring-landscape" aria-hidden="true">
        {gardenSeasons.map((key) => (
          <div className="spring-landscape-layer" key={key} data-chapter={key} data-active={key === season}>
            <Image
              src={`/images/home/${chapters[key].landscape}.webp`}
              alt=""
              fill
              unoptimized
              preload={key === "spring"}
              loading={key === "spring" ? undefined : "eager"}
              fetchPriority={key === "spring" ? undefined : "low"}
            />
          </div>
        ))}
        <SpringPond active={near && season === "spring"} />
        <SummerPond active={near && season === "summer"} />
        <AutumnPond active={near && season === "autumn"} />
        <WinterPond active={near && season === "winter"} />
      </div>

      <div className="spring-copy">
        <p className="spring-chapter" aria-live="polite">
          <span>{chapter.label}</span><span>{chapter.term}</span>
        </p>
        <h1 id="spring-title">
          <Image src="/images/home/home-title-calligraphy.webp" alt="二十四节气" width={1040} height={276} unoptimized preload />
        </h1>
        <p className="spring-intro">从一枝花、一场雨，读懂四时。</p>
      </div>

      {gardenSeasons.map((key) => {
        const plant = chapters[key].plant;
        if (!plant) return null;
        return (
          <div className="spring-foreground" key={key} data-chapter={key} data-active={key === season} aria-hidden="true">
            <Image
              className={plant}
              src={`/images/home/${plant}.webp`}
              alt=""
              width={1300}
              height={867}
              unoptimized
              preload={key === "spring"}
              loading={key === "spring" ? undefined : "eager"}
              fetchPriority={key === "spring" ? undefined : "low"}
            />
          </div>
        );
      })}

      <div className="spring-window-trim" aria-hidden="true">
        <div className="spring-window-transom"><span /><span /><span /></div>
        <div className="spring-window-jamb spring-window-jamb-left"><span /><span /></div>
        <div className="spring-window-jamb spring-window-jamb-right"><span /><span /></div>
        <div className="spring-window-sill" />
      </div>

      <button
        ref={viewButtonRef}
        className="spring-view-control"
        type="button"
        aria-label={near ? "退回窗前" : "走近窗边"}
        aria-pressed={near}
        onClick={changeView}
      >
        <span className="spring-view-badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path className="spring-view-handle" d="m15.5 15.5 5 5" />
            <path d="M7.5 10.5h6" />
            {!near && <path d="M10.5 7.5v6" />}
          </svg>
          <span>{near ? "退回窗前" : "走近看景"}</span>
        </span>
      </button>

      <div className="spring-picker">
        <div className="spring-switch" role="group" aria-label="切换季节">
          {gardenSeasons.map((key) => (
            <button key={key} type="button" data-season={key} aria-pressed={key === season} onClick={() => void selectSeason(key)}>
              <span>{chapters[key].label}</span>
            </button>
          ))}
        </div>
        {loadError && <p className="spring-scene-error" role="status">{loadError}</p>}
      </div>
    </div>
  );
}
