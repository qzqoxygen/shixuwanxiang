// Original paper-cut scenery, not a terrain model or a named mountain range.
export default function PaperLandscape({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} className="province-landscape" aria-hidden="true">
    <ellipse cx="46" cy="47" rx="44" ry="5" fill="#435e4b" opacity=".12" />
    <path d="M1 42 L21 14 L35 28 L51 5 L76 43 Z" fill="#b2c4b0" stroke="#657e69" strokeWidth=".7" />
    <path d="M21 14 L18 38 L35 28 Z M51 5 L46 39 L76 43 Z" fill="#658c7d" />
    <path d="M12 46 L39 9 L59 35 L70 21 L91 46 Z" fill="#8cae98" stroke="#4d7164" strokeWidth=".8" />
    <path d="M39 9 L34 41 L12 46 Z" fill="#d0d3af" />
    <path d="M39 9 L59 35 L49 39 L43 27 Z M70 21 L91 46 L66 44 Z" fill="#496e62" />
    <path d="M16 48 Q38 43 52 48 Q66 52 85 46" fill="none" stroke="#e9dfb7" strokeWidth="2" />
    <path d="M3 50 Q22 47 31 50 M58 53 Q76 55 94 50" fill="none" stroke="#728d86" strokeWidth="1" />
    <g fill="#456a55" stroke="#456a55" strokeWidth="1">
      <path d="M8 46 V33 M4 38 Q8 31 13 38 M2 42 Q8 35 15 42" />
      <path d="M82 45 V33 M78 37 Q82 31 87 37 M76 41 Q82 35 89 41" />
    </g>
    <path d="M23 36 L28 30 M25 40 L31 32 M50 37 L46 30 M74 36 L78 41" stroke="#f3ebcb" opacity=".65" strokeWidth=".8" />
  </g>;
}
