"use client";

import Image from "next/image";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import AutumnPond from "./AutumnPond";
import { chapters, gardenImage, gardenSeasons, pondImages, type GardenSeason } from "./garden-seasons";
import SpringPond from "./SpringPond";
import SummerPond from "./SummerPond";
import WinterPond from "./WinterPond";

const ponds = { spring: SpringPond, summer: SummerPond, autumn: AutumnPond, winter: WinterPond };

export default function SpringScene() {
  const [{ season, near }, setView] = useState<{ season: GardenSeason; near: boolean }>({ season: "spring", near: false });
  const [visitedSeasons, setVisitedSeasons] = useState<ReadonlySet<GardenSeason>>(() => new Set(["spring"]));
  const [visitedPonds, setVisitedPonds] = useState<ReadonlySet<GardenSeason>>(() => new Set());
  const [status, setStatus] = useState<"loading" | "error" | null>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const viewButtonRef = useRef<HTMLButtonElement>(null);
  const selection = useRef(0);
  const loads = useRef(new Map<string, Promise<void>>());
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
    void showScene(season, !near);
  }

  function returnOnEscape(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape" || (!near && !status)) return;
    void showScene(season, false);
    viewButtonRef.current?.focus({ preventScroll: true });
  }

  function loadImage(src: string) {
    const pending = loads.current.get(src);
    if (pending) return pending;

    const image = new window.Image();
    let timeout: number;
    const load = new Promise<void>((resolve, reject) => {
      timeout = window.setTimeout(() => reject(new Error("Scene image timed out")), 15000);
      image.src = src;
      image.decode().then(resolve, reject);
    }).catch((error: unknown) => {
      loads.current.delete(src);
      throw error;
    }).finally(() => window.clearTimeout(timeout));

    loads.current.set(src, load);
    return load;
  }

  async function showScene(next: GardenSeason, nextNear: boolean) {
    const request = ++selection.current;
    const stage = sceneRef.current;
    if (!stage) return;

    const sources: string[] = [];
    const nextChapter = chapters[next];
    if (!visitedSeasons.has(next)) {
      sources.push(gardenImage(nextChapter.landscape));
      if (nextChapter.plant) sources.push(gardenImage(nextChapter.plant));
    }
    if (nextNear && !visitedPonds.has(next)) sources.push(...pondImages[next]);

    if (sources.length) {
      setStatus("loading");
      try {
        await Promise.all(sources.map(loadImage));
      } catch {
        if (stage.isConnected && request === selection.current) setStatus("error");
        return;
      }
    }

    if (!stage.isConnected || request !== selection.current) return;
    if (near !== nextNear) clearOffset(stage);
    if (!visitedSeasons.has(next)) setVisitedSeasons((current) => new Set(current).add(next));
    if (nextNear && !visitedPonds.has(next)) setVisitedPonds((current) => new Set(current).add(next));
    setView({ season: next, near: nextNear });
    setStatus(null);
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
        {gardenSeasons.filter((key) => visitedSeasons.has(key)).map((key) => (
          <div className="spring-landscape-layer" key={key} data-chapter={key} data-active={key === season}>
            <Image
              src={gardenImage(chapters[key].landscape)}
              alt=""
              fill
              unoptimized
              preload={key === "spring"}
              loading={key === "spring" ? undefined : "eager"}
              fetchPriority={key === "spring" ? undefined : "low"}
            />
          </div>
        ))}
        {gardenSeasons.filter((key) => visitedPonds.has(key)).map((key) => {
          const Pond = ponds[key];
          return <Pond key={key} active={near && season === key} />;
        })}
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

      {gardenSeasons.filter((key) => visitedSeasons.has(key)).map((key) => {
        const plant = chapters[key].plant;
        if (!plant) return null;
        return (
          <div className="spring-foreground" key={key} data-chapter={key} data-active={key === season} aria-hidden="true">
            <Image
              className={plant}
              src={gardenImage(plant)}
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
      />

      <div className="spring-picker">
        <div className="spring-switch" role="group" aria-label="切换季节">
          {gardenSeasons.map((key) => (
            <button key={key} type="button" data-season={key} aria-pressed={key === season} onClick={() => void showScene(key, near)}>
              <span>{chapters[key].label}</span>
            </button>
          ))}
        </div>
      </div>
      {status && (
        <p className="spring-scene-status" data-status={status} role="status">
          {status === "loading" ? "画面加载中…" : "画面加载失败，请再试一次。"}
        </p>
      )}
    </div>
  );
}
