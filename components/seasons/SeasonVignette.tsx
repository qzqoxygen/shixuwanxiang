import type { ReactNode } from "react";
import type { Season } from "@/lib/solar-terms";

const effects = {
  spring: <>
    <g transform="translate(171 91)">
      <path className="seasons-vignette-drift" fill="#b96d7a" d="M0 0q3-5 8-4C7 1 4 3 0 0Z" />
    </g>
    <g transform="translate(202 69)">
      <path className="seasons-vignette-drift" data-drift="late" fill="#cb8791" d="M0 0q4-5 8-3C8 1 3 3 0 0Z" />
    </g>
    <g transform="translate(145 110)">
      <path className="seasons-vignette-drift" data-drift="last" fill="#c57e8d" d="M0 0q3-4 7-2C5 2 2 3 0 0Z" />
    </g>
  </>,
  summer: <>
    <path className="seasons-vignette-ripple" fill="none" stroke="#78928a" strokeWidth=".8"
      d="M74 136c-10-2-7-5 8-6 8-1 18-1 26 0m4 7c-8 2-22 2-31 0" />
    <path className="seasons-vignette-ripple" data-drift="late" fill="none" stroke="#718d84" strokeWidth=".9"
      d="M149 143c-9-3-3-6 12-7 13-1 31 0 42 3m1 4c-11 4-32 4-45 2" />
  </>,
  autumn: <>
    <g transform="translate(244 94)">
      <path className="seasons-vignette-drift" fill="#b99147"
        d="M0 1c-4-3-11-7-8-11 2-3 6-1 8 0 4-3 9 0 7 3-2 4-5 6-7 8Z" />
    </g>
    <g transform="translate(169 115)">
      <path className="seasons-vignette-drift" data-drift="late" fill="#c1a260"
        d="M0 0c-5-4-9-5-8-9 1-3 5-3 8-1 3-2 7 0 6 4-1 2-3 4-6 6Z" />
    </g>
  </>,
  winter: <>
    <g transform="translate(106 31)">
      <path className="seasons-vignette-drift" fill="#8da3a2" d="M0 0q-1-2 1-3 3 0 2 2-1 2-3 1Z" />
    </g>
    <g transform="translate(183 14)">
      <path className="seasons-vignette-drift" data-drift="late" fill="#94a7a7" d="M0 0q-2-2 1-3 2 0 2 2-1 1-3 1Z" />
    </g>
    <g transform="translate(252 37)">
      <path className="seasons-vignette-drift" data-drift="last" fill="#8da3a2" d="M0 0q0-2 2-2 2 2-1 3Z" />
    </g>
  </>,
} satisfies Record<Season, ReactNode>;

export default function SeasonVignette({ season }: { season: Season }) {
  return <div className="seasons-vignette" data-vignette={season} aria-hidden="true">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 360 160"
      preserveAspectRatio={season === "spring" ? "xMinYMid meet" : undefined}
      focusable="false"
    >
      <image className="seasons-vignette-art" href={`/images/seasons-ink/${season}.webp`} width="360" height="160" />
      {effects[season]}
    </svg>
  </div>;
}
