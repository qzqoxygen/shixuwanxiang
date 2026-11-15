"use client";

import Image from "next/image";
import { useRef } from "react";
import { pondImages } from "./garden-seasons";
import { usePondWater } from "./use-pond-water";

const waterline = [[0, .48], [.89, .49], [.96, .56], [1, .59], [1, 1], [0, 1]] as const;
const [pondSource, lotusSource] = pondImages.summer;

export default function SummerPond({ active }: { active: boolean }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const waterRef = useRef<HTMLCanvasElement>(null);

  usePondWater(active, imageRef, waterRef, waterline);

  return (
    <div className="spring-pond summer-pond" data-active={active}>
      <Image ref={imageRef} src={pondSource} fill alt="" unoptimized loading="eager" fetchPriority="low" />
      <canvas ref={waterRef} className="spring-pond-water" width={768} height={512} />
      <div className="summer-pond-plants">
        <div className="summer-lotus-cluster">
          <div className="summer-lotus-wake" />
          <div className="summer-lotus-reflection">
            <Image src={lotusSource} alt="" width={960} height={640} unoptimized loading="eager" fetchPriority="low" />
          </div>
          <Image className="summer-lotus-sway" src={lotusSource} alt="" width={960} height={640} unoptimized loading="eager" fetchPriority="low" />
          {active && ["upper", "lower"].map((flight) => (
            <span key={flight} className="summer-dragonfly" data-flight={flight} aria-hidden="true">
              <span className="summer-dragonfly-wings" />
              <span className="summer-dragonfly-wings" />
              <i className="summer-dragonfly-body" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
