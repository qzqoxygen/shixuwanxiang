"use client";

import Image from "next/image";
import { useRef, type CSSProperties } from "react";

import { usePondWater } from "./use-pond-water";

const waterline = [
  [0, .48], [.64, .48], [1, .51], [1, .59], [.89, .66], [.88, .70],
  [.80, .72], [.77, .77], [.70, .79], [.63, .86], [.47, .92], [.35, 1], [0, 1],
] as const;

const fallingLeaves = [
  { x: 87, y: 9, drift: -31, fall: 57, size: 1.22, duration: 11, delay: -2.4 },
  { x: 76, y: 15, drift: -22, fall: 50, size: .86, duration: 13.6, delay: -8.1 },
  { x: 68, y: 22, drift: -36, fall: 47, size: 1.1, duration: 12.7, delay: -4.7 },
  { x: 94, y: 20, drift: -19, fall: 55, size: .71, duration: 14.2, delay: -10.4 },
  { x: 60, y: 19, drift: -19, fall: 49, size: .66, duration: 11.9, delay: -6.2 },
  { x: 82, y: 25, drift: -28, fall: 45, size: .97, duration: 12.3, delay: -9.9 },
  { x: 97, y: 14, drift: -35, fall: 56, size: 1.27, duration: 10.8, delay: -5.1 },
];

export default function AutumnPond({ active }: { active: boolean }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const waterRef = useRef<HTMLCanvasElement>(null);

  usePondWater(active, imageRef, waterRef, waterline);

  return (
    <div className="spring-pond autumn-pond" data-active={active}>
      <Image ref={imageRef} src="/images/home/autumn-pond-close.webp" fill alt="" unoptimized loading="eager" fetchPriority="low" />
      <canvas ref={waterRef} className="spring-pond-water" width={768} height={512} />
      {active && (
        <div className="spring-pond-air">
          <span className="autumn-floating-leaf"><i /></span>
          {fallingLeaves.map(({ x, y, drift, fall, size, duration, delay }) => (
            <span
              key={x}
              className="autumn-falling-leaf"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                "--leaf-drift": `${drift}cqw`,
                "--leaf-fall": `${fall}cqh`,
                "--leaf-size": size,
                "--leaf-duration": `${duration}s`,
                "--leaf-delay": `${delay}s`,
              } as CSSProperties}
            ><i /></span>
          ))}
        </div>
      )}
    </div>
  );
}
