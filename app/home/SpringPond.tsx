"use client";

import Image from "next/image";
import { useRef, type CSSProperties } from "react";

import { pondImages } from "./garden-seasons";
import { usePondWater } from "./use-pond-water";

const waterline = [
  [0, .49], [.48, .49], [.48, .68], [.75, .68], [.82, .63],
  [.94, .63], [.85, .79], [.78, 1], [0, 1],
] as const;

const [pondSource] = pondImages.spring;
const petals = [
  { x: 79, y: 4, drift: -26, fall: 73, duration: 9.8, delay: -3.2, near: true },
  { x: 93, y: 10, drift: -23, fall: 80, duration: 10.6, delay: -7.1, near: true },
  { x: 68, y: -3, drift: -18, fall: 66, duration: 8.4, delay: -1.7, near: true },
  { x: 99, y: 21, drift: -23, fall: 64, duration: 8.8, delay: -5.9, near: true },
  { x: 63, y: 6, drift: -22, fall: 52, duration: 12.3, delay: -6.9, near: false },
  { x: 75, y: 14, drift: -15, fall: 67, duration: 12.9, delay: -1.4, near: false },
  { x: 87, y: -2, drift: -29, fall: 60, duration: 11.7, delay: -4.7, near: false },
  { x: 97, y: 0, drift: -13, fall: 59, duration: 13.4, delay: -10.1, near: false },
];

export default function SpringPond({ active }: { active: boolean }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const waterRef = useRef<HTMLCanvasElement>(null);

  usePondWater(active, imageRef, waterRef, waterline);

  return (
    <div className="spring-pond" data-active={active}>
      <Image ref={imageRef} src={pondSource} fill alt="" unoptimized loading="eager" fetchPriority="low" />
      <canvas ref={waterRef} className="spring-pond-water" width={768} height={512} />
      {active && (
        <div className="spring-pond-air" aria-hidden="true">
          <span className="spring-swallow spring-swallow-near"><i /></span>
          <span className="spring-swallow spring-swallow-far"><i /></span>
          {petals.map(({ x, y, drift, fall, duration, delay, near }) => (
            <span
              key={x}
              className={`spring-petal ${near ? "spring-petal-near" : "spring-petal-far"}`}
              style={{
                left: `${x}%`,
                top: `${y}%`,
                "--petal-drift": `${drift}cqw`,
                "--petal-fall": `${fall}cqh`,
                "--petal-duration": `${duration}s`,
                "--petal-delay": `${delay}s`,
              } as CSSProperties}
            ><i /></span>
          ))}
        </div>
      )}
    </div>
  );
}
