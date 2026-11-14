"use client";

import Image from "next/image";
import { useRef, type CSSProperties } from "react";

import { usePondWater } from "./use-pond-water";

const waterline = [
  [0, .51], [.54, .52], [1, .56], [1, .64], [.91, .69], [.89, .74],
  [.83, .77], [.82, .80], [.69, .81], [.65, .85], [.65, .89], [.50, .92], [.42, 1], [0, 1],
] as const;

const snowflakes = Array.from({ length: 30 }, (_, index) => ({
  x: (index * 37 + 9) % 103,
  size: 2 + (index * 7 % 11) / 2,
  drift: index % 3 === 0 ? -10 : -3 - index % 5,
  duration: 9 + (index * 5 % 13) * .7,
  delay: -(index * 17 % 91) / 7,
  opacity: .42 + (index * 3 % 8) / 14,
}));

const petals = [
  { x: 67, y: 57, drift: -27, fall: 34, size: 15, duration: 10.2, delay: -2.1 },
  { x: 76, y: 46, drift: -16, fall: 38, size: 11, duration: 11.5, delay: -6.7 },
  { x: 81, y: 56, drift: -31, fall: 33, size: 13, duration: 12.3, delay: -5.1 },
  { x: 69, y: 63, drift: -19, fall: 28, size: 10, duration: 9.4, delay: -1.8 },
  { x: 89, y: 48, drift: -20, fall: 38, size: 12, duration: 10.7, delay: -8.2 },
  { x: 73, y: 56, drift: -36, fall: 32, size: 9, duration: 13.1, delay: -10.5 },
];

export default function WinterPond({ active }: { active: boolean }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const waterRef = useRef<HTMLCanvasElement>(null);

  usePondWater(active, imageRef, waterRef, waterline);

  return (
    <div className="spring-pond winter-pond" data-active={active}>
      <Image ref={imageRef} src="/images/home/winter-pond-close.webp" fill alt="" unoptimized loading="eager" fetchPriority="low" />
      <canvas ref={waterRef} className="spring-pond-water" width={768} height={512} />
      {active && (
        <div className="spring-pond-air winter-pond-air">
          {snowflakes.map(({ x, size, drift, duration, delay, opacity }) => (
            <span key={x} className="winter-snowflake" style={{
              left: `${x}%`,
              width: `${size}px`,
              "--snow-drift": `${drift}cqw`,
              "--snow-duration": `${duration}s`,
              "--snow-delay": `${delay}s`,
              "--snow-opacity": opacity,
            } as CSSProperties} />
          ))}
          {petals.map(({ x, y, drift, fall, size, duration, delay }) => (
            <span key={x} className="winter-plum-petal" style={{
              left: `${x}%`,
              top: `${y}%`,
              width: `${size}px`,
              "--petal-drift": `${drift}cqw`,
              "--petal-fall": `${fall}cqh`,
              "--petal-duration": `${duration}s`,
              "--petal-delay": `${delay}s`,
            } as CSSProperties}><i /></span>
          ))}
        </div>
      )}
    </div>
  );
}
