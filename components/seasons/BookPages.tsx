"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import SeasonVignette from "./SeasonVignette";
import { SEASONS, SOLAR_TERMS } from "@/lib/solar-terms";
import { SOLAR_TERM_NOTES } from "@/lib/solar-term-notes";
import { SOLAR_TERM_PHOTOS, type SolarTermPhoto } from "@/lib/solar-term-photos";

const number = (value: number) => String(value).padStart(2, "0");

export function ReadingPage({ index, titleId }: { index: number; titleId?: string }) {
  const term = SOLAR_TERMS[index];
  const season = SEASONS.find(item => item.id === term.season)!;
  const photo = SOLAR_TERM_PHOTOS[term.id];
  return <article className="seasons-reading book-page" data-season={term.season} aria-labelledby={titleId}>
    <div className="seasons-reading-top"><p>{season.name}之第{["一", "二", "三", "四", "五", "六"][index % 6]}节</p><span>节气手记</span></div>
    <div className="seasons-term-heading"><h3 className="seasons-term-title" id={titleId}>{term.name}</h3><div className="seasons-longitude"><svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="17" stroke="currentColor" strokeOpacity=".3" /><path d="M24 3v7m0 28v7M3 24h7m28 0h7" stroke="currentColor" strokeWidth=".8" /><circle cx="24" cy="24" r="3" fill="currentColor" /><g transform={`rotate(${term.solarLongitude - 90} 24 24)`}><path d="M24 24h17" stroke="currentColor" strokeWidth=".8" /><circle cx="41" cy="24" r="3" fill="currentColor" /></g></svg><p>太阳黄经<strong>{term.solarLongitude}°</strong></p></div></div>
    <p className="seasons-description">{term.description}</p>
    <SeasonVignette season={term.season} />
    <div className="seasons-reading-note">
      <span>节气小识</span>
      <p>{SOLAR_TERM_NOTES[term.id]}</p>
    </div>
    <div className="seasons-reading-links"><Link className="seasons-explore-link" href={`/explore?solarTermId=${term.id}`} aria-label={`去知时，寻访${term.name}风物`}>去知时<span className="book-wide-copy">，寻访山河风物</span> <span aria-hidden="true">↗</span></Link><a className="seasons-article-link" href={photo.articleUrl} target="_blank" rel="noopener noreferrer">阅读<span className="book-wide-copy">{term.name}</span>专题 <span aria-hidden="true">↗</span><span className="seasons-sr-only">（中国非遗网，新窗口打开）</span></a></div>
    <span className="book-page-number" aria-label={`左页，第${index * 2 + 1}页`}>{number(index * 2 + 1)}</span>
  </article>;
}

// The prepared HD WebP assets are served directly to avoid another lossy encode.
export function PhotoPage({ index }: { index: number }) {
  const term = SOLAR_TERMS[index];
  const photo: SolarTermPhoto = SOLAR_TERM_PHOTOS[term.id];
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return <figure className="seasons-photo-card book-page" data-season={term.season}>
    <div className="seasons-photo-heading"><span>{term.name}影像</span><span>点图看大图</span></div>
    <div className="seasons-photo-mat"><div className="seasons-photo-frame" data-failed={failed} aria-busy={!loaded && !failed}>
      {!failed && !loaded && <span className="seasons-photo-loading" role="status">影像加载中</span>}
      {failed ? <div className="seasons-photo-error" role="status"><span>照片暂未加载</span><a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer">前往来源页查看 <span aria-hidden="true">↗</span></a></div> : <a className="seasons-photo-open" href={photo.src} target="_blank" rel="noopener noreferrer" draggable={false} aria-label={`查看${term.name}高清大图（新窗口打开）`}><Image src={photo.src} alt={`${term.name}：${photo.caption}`} width={photo.width} height={photo.height} unoptimized loading="eager" draggable={false} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} /></a>}
    </div></div>
    <figcaption><strong>{photo.caption}</strong><div className="seasons-photo-credits"><span className="seasons-photo-credit">{photo.credit}</span><a className="seasons-photo-license" href={photo.licenseUrl} target="_blank" rel="noopener noreferrer" aria-label={`照片许可：${photo.license}（新窗口打开）`}>{photo.license}</a></div><a className="seasons-photo-source" href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`查看${term.name}照片来源：${photo.sourceName}（新窗口打开）`}>来源：{photo.sourceName} <span aria-hidden="true">↗</span></a></figcaption>
    <span className="book-page-number" aria-label={`右页，第${index * 2 + 2}页`}>{number(index * 2 + 2)}</span>
  </figure>;
}
