"use client";

import Image from "next/image";
import { useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type PointerEvent } from "react";
import { SEASONS, SOLAR_TERMS } from "@/lib/solar-terms";
import { parseStudioDraft, STUDIO_DECORATIONS as decorations, STUDIO_PALETTES as palettes, type StudioDraft, type StudioPlacement } from "@/lib/studio-draft";
import { STUDIO_FORMATS, STUDIO_LINE_LIMIT, STUDIO_TITLE_LIMIT } from "@/lib/studio-inspiration";
import stickerCatalog from "@/public/images/studio-stickers/manifest.json";
import { renderPosterPng } from "./export-poster";
import StudioInspiration from "./StudioInspiration";
import { useInitialStudioDraft, useStudioDraft } from "./use-studio-draft";

const templates = [
  { id: "field-notes", name: STUDIO_FORMATS["field-notes"], ratio: 4 / 5, format: "竖版 4:5" },
  { id: "centered", name: STUDIO_FORMATS.centered, ratio: 4 / 5, format: "竖版 4:5" },
  { id: "bookmark", name: STUDIO_FORMATS.bookmark, ratio: 1 / 3, format: "书签 1:3" },
  { id: "poster", name: STUDIO_FORMATS.poster, ratio: 3 / 4, format: "画报 3:4" },
] as const;
const editorTabs = [
  { id: "content", name: "内容" },
  { id: "style", name: "样式" },
  { id: "stickers", name: "贴纸" },
] as const;
type EditorTab = (typeof editorTabs)[number]["id"];
const sampleLines = {
  spring: "微雨过后，草木渐深。",
  summer: "荷风过水，日长一寸。",
  autumn: "一叶落处，秋色渐深。",
  winter: "寒枝静立，且待春来。",
};
const categories = [
  ...SEASONS.map(({ id, name }) => ({ id, name: `${name}季` })),
  { id: "architecture", name: "亭桥园居" },
  { id: "scenery", name: "山水" },
  { id: "wildlife", name: "飞鸟游鱼" },
];
const directions = [
  { key: "ArrowLeft", dx: -1, dy: 0 },
  { key: "ArrowUp", dx: 0, dy: -1 },
  { key: "ArrowDown", dx: 0, dy: 1 },
  { key: "ArrowRight", dx: 1, dy: 0 },
];
const corners = [
  { id: "top-left", label: "左上" },
  { id: "top-right", label: "右上" },
  { id: "bottom-left", label: "左下" },
  { id: "bottom-right", label: "右下" },
];

type Asset = (typeof stickerCatalog)[number];
type PlacedSticker = StudioPlacement & { id: number; asset: Asset; mirrored?: boolean };
type PlacedDate = StudioPlacement & { id: "date" };
type PlacedItem = PlacedSticker | PlacedDate;
type Gesture = {
  kind: "move" | "transform";
  item: PlacedItem;
  pointer: number;
  bounds: DOMRect;
  startX: number;
  startY: number;
};

const assetsById = new Map(stickerCatalog.map((asset) => [asset.id, asset]));
const starter = assetsById.get("peach-blossom");
const minSize = 16;
const maxSize = 76;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function rotationExtent(angle: number) {
  const radians = angle * Math.PI / 180;
  return Math.abs(Math.cos(radians)) + Math.abs(Math.sin(radians));
}

function fitSticker(sticker: PlacedSticker, ratio: number): PlacedSticker {
  const extent = rotationExtent(sticker.angle);
  const size = clamp(sticker.size, minSize, Math.min(maxSize, 100 / extent));
  const halfWidth = size * extent / 2;
  const halfHeight = halfWidth * ratio;
  return { ...sticker, size, x: clamp(sticker.x, halfWidth, 100 - halfWidth), y: clamp(sticker.y, halfHeight, 100 - halfHeight) };
}

function fitDate(date: PlacedDate, ratio: number, baseWidth: number): PlacedDate {
  const size = clamp(date.size, 60, 220);
  const width = size * baseWidth / 100;
  const height = width * 3 / 8;
  const radians = date.angle * Math.PI / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const halfWidth = (width * cos + height * sin) / 2;
  const halfHeight = (width * sin + height * cos) * ratio / 2;
  return { ...date, size, x: clamp(date.x, halfWidth, 100 - halfWidth), y: clamp(date.y, halfHeight, 100 - halfHeight) };
}

function StickerIcon({ name }: { name: "delete" | "copy" | "mirror" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {name === "delete" && <path d="M4 7h16M9 4h6M7 7l1 13h8l1-13" />}
      {name === "copy" && <><rect x="4" y="8" width="12" height="12" rx="2" /><path d="M8 4h10a2 2 0 0 1 2 2v10" /></>}
      {name === "mirror" && <path d="M12 4v16M9 6l-6 12h6V6Zm6 0 6 12h-6V6Z" />}
    </svg>
  );
}

export default function StudioWorkbench() {
  const snapshot = useInitialStudioDraft();
  if (snapshot === undefined) {
    return (
      <section className="studio-workbench" aria-labelledby="studio-heading" aria-busy="true">
        <header className="studio-heading">
          <div>
            <h1 id="studio-heading">造物</h1>
            <p>正在打开工坊…</p>
          </div>
        </header>
      </section>
    );
  }
  return <StudioEditor initialDraft={parseStudioDraft(snapshot)} />;
}

function StudioEditor({ initialDraft }: { initialDraft: StudioDraft | null }) {
  const [activeTab, setActiveTab] = useState<EditorTab>("content");
  const [termIndex, setTermIndex] = useState(() => initialDraft ? SOLAR_TERMS.findIndex(({ id }) => id === initialDraft.termId) : 4);
  const [templateIndex, setTemplateIndex] = useState(() => initialDraft ? templates.findIndex(({ id }) => id === initialDraft.templateId) : 0);
  const [paletteIndex, setPaletteIndex] = useState(() => initialDraft ? palettes.findIndex(({ id }) => id === initialDraft.paletteId) : 0);
  const [decoration, setDecoration] = useState(initialDraft?.decoration ?? "template");
  const [customTitle, setCustomTitle] = useState<string | null>(initialDraft?.title ?? null);
  const [customLine, setCustomLine] = useState<string | null>(initialDraft?.line ?? null);
  const [datePlacement, setDatePlacement] = useState<PlacedDate | null>(() => initialDraft?.date ? { ...initialDraft.date, id: "date" } : null);
  const [filter, setFilter] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "ready" | "error">("idle");
  const [stickers, setStickers] = useState<PlacedSticker[]>(() => {
    if (!initialDraft) return starter ? [{ id: 0, asset: starter, x: 52, y: 66, size: 67, angle: 0 }] : [];
    return initialDraft.stickers.flatMap(({ assetId, ...placement }) => {
      const asset = assetsById.get(assetId);
      return asset ? [{ ...placement, asset }] : [];
    });
  });
  const [selection, setSelection] = useState<PlacedItem["id"] | null>(null);
  const nextStickerId = useRef(stickers.reduce((next, { id }) => Math.max(next, id + 1), 1));
  const poster = useRef<HTMLElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const actionPress = useRef<{ pointer: number; button: HTMLButtonElement; x: number; y: number } | null>(null);

  const term = SOLAR_TERMS[termIndex];
  const season = SEASONS[Math.floor(termIndex / 6)];
  const template = templates[templateIndex];
  const bookmark = template.id === "bookmark";
  const dateBaseWidth = bookmark ? 28 : 14.4;
  const date = fitDate(datePlacement ?? {
    id: "date", x: bookmark ? 72 : 84.1, y: bookmark ? 11.75 : 9.16, size: 100, angle: 0,
  }, template.ratio, dateBaseWidth);
  const dateWidth = dateBaseWidth * date.size / 100;
  const palette = palettes[paletteIndex];
  const title = customTitle ?? term.name;
  const line = customLine ?? sampleLines[term.season];
  const category = filter ?? term.season;
  const placed = stickers.map((sticker) => fitSticker(sticker, template.ratio));
  const selectedSticker = placed.find(({ id }) => id === selection);
  const selected = selection === "date" ? date : selectedSticker;
  const shownAssets = stickerCatalog.filter((asset) => (asset.season ?? asset.category) === category);
  const titleLength = Array.from(title.trim()).length;
  const draftStatus = useStudioDraft({
    version: 1,
    termId: term.id,
    templateId: template.id,
    paletteId: palette.id,
    decoration,
    title: customTitle,
    line: customLine,
    date: datePlacement,
    stickers: stickers.map(({ asset, mirrored, ...placement }) => ({ ...placement, assetId: asset.id, mirrored: Boolean(mirrored) })),
  }, initialDraft !== null);

  function addSticker(asset: Asset, keyboard: boolean) {
    const id = nextStickerId.current++;
    const offset = ((id - 1) % 4) * 5;
    setStickers((current) => [...current, { id, asset, x: 64 - offset, y: 60 + offset, size: 38, angle: 0 }]);
    setSelection(id);
    if (keyboard) {
      window.requestAnimationFrame(() => poster.current?.querySelector<HTMLButtonElement>(`[data-sticker-id="${id}"]`)?.focus());
    }
  }

  function revealEditorControl(event: FocusEvent<HTMLElement>) {
    const control = event.target;
    window.requestAnimationFrame(() => {
      if (document.activeElement !== control) return;
      const bounds = control.getBoundingClientRect();
      const desk = poster.current?.closest<HTMLElement>(".studio-preview");
      const deskBounds = desk?.getBoundingClientRect();
      const underDesk = desk && deskBounds && getComputedStyle(desk).position === "sticky"
        && bounds.left < deskBounds.right && bounds.right > deskBounds.left;
      const top = underDesk ? Math.max(8, deskBounds.bottom + 8) : 8;
      const bottom = window.innerHeight - 8;
      if (bounds.top < top) window.scrollBy(0, bounds.top - top);
      else if (bounds.bottom > bottom) window.scrollBy(0, bounds.bottom - bottom);
    });
  }

  function handleEditorTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = editorTabs.length - 1;
    let next: number;
    switch (event.key) {
      case "ArrowLeft": next = index === 0 ? last : index - 1; break;
      case "ArrowRight": next = index === last ? 0 : index + 1; break;
      case "Home": next = 0; break;
      case "End": next = last; break;
      default: return;
    }
    event.preventDefault();
    const { id } = editorTabs[next];
    setActiveTab(id);
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#studio-tab-${id}`)?.focus();
  }

  function removeSticker(id: number) {
    setStickers((current) => current.filter((sticker) => sticker.id !== id));
    setSelection(null);
    poster.current?.focus({ preventScroll: true });
  }

  function duplicateSticker(sticker: PlacedSticker) {
    const id = nextStickerId.current++;
    const copy = fitSticker({
      ...sticker, id,
      x: sticker.x + (sticker.x > 62 ? -7 : 7),
      y: sticker.y + (sticker.y > 76 ? -5 : 5),
    }, template.ratio);
    setStickers((current) => [...current, copy]);
    setSelection(id);
  }

  function updateItem(item: PlacedItem) {
    if (item.id === "date") {
      setDatePlacement(fitDate(item, template.ratio, dateBaseWidth));
      return;
    }
    const fitted = fitSticker(item, template.ratio);
    setStickers((current) => current.map((item) => item.id === fitted.id ? fitted : item));
  }

  function mirrorSticker(sticker: PlacedSticker) {
    setStickers((current) => current.map((item) => item.id === sticker.id
      ? { ...item, mirrored: !item.mirrored } : item));
  }

  function startGesture(event: PointerEvent<HTMLButtonElement>, item: PlacedItem, kind: Gesture["kind"]) {
    const bounds = poster.current?.getBoundingClientRect();
    if (!event.isPrimary || event.button !== 0 || gesture.current || !bounds?.width || !bounds.height) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelection(item.id);
    gesture.current = { kind, item, pointer: event.pointerId, bounds, startX: event.clientX, startY: event.clientY };
  }

  function moveGesture(event: PointerEvent<HTMLDivElement>) {
    const active = gesture.current;
    if (!active || active.pointer !== event.pointerId) return;
    const { bounds, startX, startY, item, kind } = active;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (kind === "move") {
      updateItem({ ...item, x: item.x + dx * 100 / bounds.width, y: item.y + dy * 100 / bounds.height });
      return;
    }
    const centerX = bounds.left + bounds.width * item.x / 100;
    const centerY = bounds.top + bounds.height * item.y / 100;
    const fromX = startX - centerX;
    const fromY = startY - centerY;
    const toX = event.clientX - centerX;
    const toY = event.clientY - centerY;
    const distance = Math.hypot(toX, toY);
    if (distance < 4) return;
    const delta = Math.atan2(toY, toX) - Math.atan2(fromY, fromX);
    updateItem({
      ...item,
      size: item.size * distance / (Math.hypot(fromX, fromY) || 1),
      angle: (item.angle + delta * 180 / Math.PI + 720) % 360,
    });
  }

  function stopGesture(event: PointerEvent<HTMLDivElement>) {
    if (gesture.current?.pointer === event.pointerId) gesture.current = null;
    if (actionPress.current?.pointer === event.pointerId) actionPress.current = null;
  }

  function startAction(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    actionPress.current = { pointer: event.pointerId, button: event.currentTarget, x: event.clientX, y: event.clientY };
  }

  function finishAction(event: PointerEvent<HTMLButtonElement>, action: () => void) {
    const press = actionPress.current;
    if (press?.pointer !== event.pointerId || press.button !== event.currentTarget) return;
    actionPress.current = null;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) <= 12) action();
  }

  function handleItemKey(event: KeyboardEvent<HTMLButtonElement>, item: PlacedItem) {
    if (item.id !== "date" && (event.key === "Delete" || event.key === "Backspace")) {
      event.preventDefault();
      removeSticker(item.id);
      return;
    }
    if (event.key === "Escape") {
      setSelection(null);
      poster.current?.focus({ preventScroll: true });
      return;
    }
    if (event.key === "+" || event.key === "-") {
      event.preventDefault();
      setSelection(item.id);
      updateItem({ ...item, size: item.size + (event.key === "+" ? 1 : -1) * (item.id === "date" ? 10 : 4) });
      return;
    }
    const direction = directions.find(({ key }) => key === event.key);
    if (!direction) return;
    event.preventDefault();
    setSelection(item.id);
    updateItem({ ...item, x: item.x + direction.dx * 2, y: item.y + direction.dy * 2 });
  }

  async function savePoster() {
    if (!poster.current || saveStatus === "saving") return;
    setSaveStatus("saving");
    try {
      const png = await renderPosterPng(poster.current);
      const name = title.replace(/[<>:"/\\|?*]/g, "").replace(/[. ]+$/, "").trim() || term.name;
      const download = document.createElement("a");
      const url = URL.createObjectURL(png);
      download.href = url;
      download.download = `${name}-${template.name}.png`;
      document.body.append(download);
      try {
        download.click();
      } finally {
        download.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
      setSaveStatus("ready");
    } catch {
      setSaveStatus("error");
    }
  }

  return (
    <section className="studio-workbench" aria-labelledby="studio-heading">
      <header className="studio-heading">
        <span className="studio-heading-mist" aria-hidden="true" />
        <div>
          <div className="studio-heading-title">
            <h1 id="studio-heading">造物</h1>
            <span className="studio-heading-seal" aria-hidden="true">笺</span>
          </div>
          <p>做一张属于你的节气卡</p>
          <p className="studio-draft-status" data-status={draftStatus} role="status">
            {draftStatus === "saved" ? "草稿已保存在此浏览器" : draftStatus === "saving" ? "正在保存草稿…"
              : draftStatus === "error" ? "无法自动保存草稿，可以先保存图片" : "编辑后自动保存草稿"}
          </p>
        </div>
        <div className="studio-actions">
          <span id="studio-preview-status" role="status" data-status={saveStatus}>
            {saveStatus === "ready" ? "图片已生成" : saveStatus === "error" ? "生成失败，请重试" : "PNG · 长边 1800 px"}
          </span>
          <button type="button" aria-disabled={saveStatus === "saving"} aria-describedby="studio-preview-status" onClick={savePoster}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v11m-4-4 4 4 4-4M5 15v5h14v-5" />
            </svg>
            {saveStatus === "saving" ? "生成中…" : "保存图片"}
          </button>
        </div>
      </header>

      <figure className="studio-preview">
        <figcaption className="studio-preview-caption">
          <h2>作品预览</h2>
          <span className="studio-preview-format">{template.format}</span>
        </figcaption>
        <div
          className="studio-poster-size"
          style={{ "--poster-ratio": template.ratio } as CSSProperties}
          onPointerMove={moveGesture}
          onPointerUp={stopGesture}
          onPointerCancel={stopGesture}
          onLostPointerCapture={stopGesture}
        >
          <span className="studio-desk-inkstone" aria-hidden="true" />
          <article
            ref={poster}
            className="studio-poster"
            aria-label={`${term.name} · ${template.name}预览`}
            data-template={template.id}
            data-palette={palette.id}
            data-decoration={decoration}
            tabIndex={-1}
            onClick={(event) => { if (event.target === event.currentTarget) setSelection(null); }}
          >
            <button type="button" className="studio-poster-date"
              aria-pressed={selection === "date"}
              aria-label={`日期 ${String(termIndex + 1).padStart(2, "0")} / ${SOLAR_TERMS.length}`}
              title="拖动日期调整位置"
              style={{ left: `${date.x}%`, top: `${date.y}%`, fontSize: `${dateWidth / 4}cqw`, rotate: `${date.angle}deg` }}
              onClick={() => setSelection("date")}
              onPointerDown={(event) => startGesture(event, date, "move")}
              onKeyDown={(event) => handleItemKey(event, date)}
            >
              {String(termIndex + 1).padStart(2, "0")} / {SOLAR_TERMS.length}
            </button>
            <div className="studio-poster-title" data-length={titleLength > 8 ? "long" : titleLength > 4 ? "medium" : "short"}>
              <span>{title}</span><span className="studio-poster-seal" aria-hidden="true">{season.name}</span>
            </div>
            <p className="studio-poster-line">{line}</p>
            {placed.map((sticker) => (
              <button
                type="button"
                key={sticker.id}
                className="studio-placed-sticker"
                data-sticker-id={sticker.id}
                style={{ left: `${sticker.x}%`, top: `${sticker.y}%`, width: `${sticker.size}%`, rotate: `${sticker.angle}deg` }}
                aria-label={`画面中的${sticker.asset.name}`}
                aria-pressed={sticker.id === selection}
                data-mirrored={Boolean(sticker.mirrored)}
                onClick={() => setSelection(sticker.id)}
                onPointerDown={(event) => startGesture(event, sticker, "move")}
                onKeyDown={(event) => handleItemKey(event, sticker)}
              >
                <Image src={sticker.asset.src} width={sticker.asset.width} height={sticker.asset.height} alt="" draggable={false} unoptimized />
              </button>
            ))}
          </article>
          {selected && (
            <div
              className="studio-selection"
              role="group"
              aria-label={selected.id === "date" ? "编辑日期" : `编辑${selected.asset.name}`}
              style={{
                "--selection-x": `${selected.x}%`,
                "--selection-y": `${selected.y}%`,
                "--selection-size": `${selected.id === "date" ? dateWidth : selected.size}%`,
                "--selection-height": selected.id === "date" ? `max(${dateWidth * 3 / 8}cqw, 28px)` : undefined,
                "--selection-edge": selectedSticker && `calc(max(${selectedSticker.size}cqi, 44px) * ${rotationExtent(selectedSticker.angle) / 2})`,
                "--selection-angle": `${selected.angle}deg`,
              } as CSSProperties}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSelection(null);
                  poster.current?.focus({ preventScroll: true });
                }
              }}
            >
              <div className="studio-selection-frame">
                {corners.map(({ id, label }) => (
                  <button key={id} type="button" className="studio-selection-corner" data-corner={id}
                    aria-label={`${label}缩放和旋转手柄，上下键缩放，左右键旋转`}
                    title="沿对角线拖动缩放，绕中心拖动旋转"
                    onPointerDown={(event) => startGesture(event, selected, "transform")}
                    onKeyDown={(event) => {
                      const direction = directions.find(({ key }) => key === event.key);
                      if (!direction) return;
                      event.preventDefault();
                      updateItem({
                        ...selected,
                        size: selected.size - direction.dy * (selected.id === "date" ? 10 : 4),
                        angle: (selected.angle + direction.dx * 15 + 360) % 360,
                      });
                    }}
                  />
                ))}
              </div>
              {selectedSticker && (
                <>
                  <button type="button" className="studio-selection-action" data-action="delete"
                    aria-label="删除贴纸" title="删除" onPointerDown={startAction}
                    onPointerUp={(event) => finishAction(event, () => removeSticker(selectedSticker.id))}
                    onClick={(event) => { if (event.detail === 0) removeSticker(selectedSticker.id); }}>
                    <StickerIcon name="delete" />
                  </button>
                  <button type="button" className="studio-selection-action" data-action="copy"
                    aria-label="复制贴纸" title="复制" onPointerDown={startAction}
                    onPointerUp={(event) => finishAction(event, () => duplicateSticker(selectedSticker))}
                    onClick={(event) => { if (event.detail === 0) duplicateSticker(selectedSticker); }}>
                    <StickerIcon name="copy" />
                  </button>
                  <button type="button" className="studio-selection-action" data-action="mirror"
                    aria-label="左右镜像" title="左右镜像" aria-pressed={Boolean(selectedSticker.mirrored)} onPointerDown={startAction}
                    onPointerUp={(event) => finishAction(event, () => mirrorSticker(selectedSticker))}
                    onClick={(event) => { if (event.detail === 0) mirrorSticker(selectedSticker); }}>
                    <StickerIcon name="mirror" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </figure>

      <section className="studio-editor" aria-labelledby="studio-editor-heading" onFocus={revealEditorControl}>
        <h2 id="studio-editor-heading">编辑作品</h2>
        <div className="studio-editor-tabs" role="tablist" aria-label="作品编辑分类">
          {editorTabs.map(({ id, name }, index) => (
            <button key={id} type="button" role="tab" id={`studio-tab-${id}`} aria-controls={`studio-panel-${id}`}
              aria-selected={activeTab === id} tabIndex={activeTab === id ? 0 : -1}
              onClick={() => setActiveTab(id)} onKeyDown={(event) => handleEditorTabKey(event, index)}>
              {name}
            </button>
          ))}
        </div>
        <div className="studio-fields" role="tabpanel" id="studio-panel-content" aria-labelledby="studio-tab-content" hidden={activeTab !== "content"}>
          <fieldset>
            <legend>节气与版式</legend>
            <label>
              节气
              <select value={termIndex} onChange={(event) => setTermIndex(Number(event.currentTarget.value))}>
                {SEASONS.map(({ id, name }, seasonIndex) => (
                  <optgroup key={id} label={`${name}季`}>
                    {SOLAR_TERMS.slice(seasonIndex * 6, seasonIndex * 6 + 6).map((option, index) => (
                      <option key={option.id} value={seasonIndex * 6 + index}>{option.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <div className="studio-template-options" role="group" aria-label="选择版式">
              {templates.map((option, index) => (
                <button key={option.id} type="button" data-template={option.id} title={option.format}
                  aria-pressed={index === templateIndex} onClick={() => setTemplateIndex(index)}>
                  <span className="studio-template-sample" aria-hidden="true" style={{ aspectRatio: option.ratio }} />
                  {option.name}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>卡片文字</legend>
            <label>
              标题
              <input type="text" value={title} maxLength={STUDIO_TITLE_LIMIT} onChange={(event) => setCustomTitle(event.currentTarget.value)} />
            </label>
            <label>
              短句
              <textarea rows={2} value={line} maxLength={STUDIO_LINE_LIMIT} onChange={(event) => setCustomLine(event.currentTarget.value)} />
            </label>
            <StudioInspiration
              key={`${term.id}:${template.id}`}
              term={term}
              format={template.id}
              onApply={(field, value) => field === "title" ? setCustomTitle(value) : setCustomLine(value)}
            />
          </fieldset>
        </div>
        <div className="studio-fields" role="tabpanel" id="studio-panel-style" aria-labelledby="studio-tab-style" hidden={activeTab !== "style"}>
          <fieldset className="studio-colorway">
            <legend>底色</legend>
            <div className="studio-palette-options">
              {palettes.map((option, index) => (
                <button key={option.id} type="button" data-palette={option.id} aria-pressed={index === paletteIndex} onClick={() => setPaletteIndex(index)}>
                  <span className="studio-swatch" aria-hidden="true" />
                  {option.name}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="studio-decorations">
            <legend>边框与花纹</legend>
            <div className="studio-decoration-options">
              {decorations.map((option) => (
                <button key={option.id} type="button" data-decoration={option.id} aria-pressed={decoration === option.id} onClick={() => setDecoration(option.id)}>
                  <span className="studio-decoration-sample" aria-hidden="true" />
                  {option.name}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="studio-fields" role="tabpanel" id="studio-panel-stickers" aria-labelledby="studio-tab-stickers" hidden={activeTab !== "stickers"}>
          <fieldset className="studio-library">
            <legend>贴纸素材</legend>
            {stickers.length > 1 && (
              <label>
                画面中的贴纸
                <select value={selectedSticker?.id ?? ""} onChange={(event) => {
                  const value = event.currentTarget.value;
                  setSelection(value === "" ? null : Number(value));
                }}>
                  <option value="">请选择</option>
                  {stickers.map(({ id, asset }, index) => <option key={id} value={id}>{index + 1} · {asset.name}</option>)}
                </select>
              </label>
            )}
            <label>
              素材分类
              <select value={category} onChange={(event) => setFilter(event.currentTarget.value)}>
                {categories.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
            <div className="studio-library-grid">
              {shownAssets.map((asset) => (
                <button key={asset.id} type="button" aria-label={`添加${asset.name}`} onClick={(event) => addSticker(asset, event.detail === 0)}>
                  <Image src={asset.src} width={asset.width} height={asset.height} alt="" unoptimized />
                  <span>{asset.name}</span>
                </button>
              ))}
            </div>
            <p className="studio-library-count" role="status">
              素材共 {stickerCatalog.length} 张 · 已摆放 {stickers.length} 张{selectedSticker && ` · 已选 ${selectedSticker.asset.name}`}
            </p>
          </fieldset>
        </div>
      </section>
    </section>
  );
}
