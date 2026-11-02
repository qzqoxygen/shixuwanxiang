// Decorative margin painting, deliberately outside the geographic map.
// These brush strokes do not represent real mountains or river courses.
export default function InkLandscape() {
  return (
    <g className="culture-map-landscape" aria-hidden="true" pointerEvents="none" transform="translate(30 405)">
      <defs>
        <linearGradient id="ink-distant-wash" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#78958c" stopOpacity=".32" />
          <stop offset="1" stopColor="#bac4af" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ink-near-wash" x1="0" y1="0" x2=".2" y2="1">
          <stop offset="0" stopColor="#466963" stopOpacity=".48" />
          <stop offset="1" stopColor="#859b82" stopOpacity=".03" />
        </linearGradient>
      </defs>
      <path fill="url(#ink-distant-wash)" d="M0 91 Q18 72 29 54 L39 63 Q52 37 65 19 Q76 27 84 44 L93 36 Q109 47 120 65 Q134 43 148 34 L164 52 L176 45 Q195 61 210 81 L242 99 Z" />
      <path fill="url(#ink-near-wash)" d="M9 108 Q26 93 42 76 L52 81 Q72 58 86 39 L98 49 L107 43 Q121 60 129 76 L142 68 Q158 87 179 94 L201 113 Z" />
      <g fill="none" stroke="#57756c" strokeLinecap="round" strokeLinejoin="round">
        <path opacity=".45" strokeWidth="1.1" d="M22 91 L42 76 L52 81 L71 59 L86 39 L98 49 L107 43 L121 63 L129 76 M87 43 L81 65 L88 77 L82 92 M107 48 L102 68 L110 82 M135 78 L142 68 L159 87" />
        <path opacity=".22" strokeWidth=".7" d="M36 62 L65 19 L76 31 L84 44 M64 27 L61 49 L70 64 M132 55 L148 34 L163 53 M148 40 L144 57 L155 72 M49 86 L66 73 M54 94 L75 77 M94 65 L99 78 M92 80 L96 90 M115 74 L120 86" />
        <path opacity=".36" strokeWidth="1.5" d="M0 113 Q34 104 65 110 M112 116 Q147 105 183 115 M198 115 L226 120" />
      </g>
      <g fill="none" stroke="#699398" strokeLinecap="round" opacity=".36">
        <path d="M159 99 Q229 97 218 110 Q207 120 151 121 Q91 124 66 136" strokeWidth="1.3" />
        <path d="M169 105 Q212 103 206 109 M127 131 Q173 126 201 127 M12 132 L48 132 M30 140 L59 140" strokeWidth=".65" />
      </g>
      <g fill="#4f6c60" opacity=".55">
        <path d="M39 103 l2 -17 l2 17 Z M31 91 q10 -12 21 0 q-8 -2 -11 1 q-4 -2 -10 -1 M32 97 q9 -10 20 0 q-12 -3 -20 0" />
        <path d="M22 111 l1 -12 l2 12 Z M17 103 q7 -9 14 0 q-7 -2 -14 0" />
      </g>
      <text x="4" y="152" className="culture-map-landscape-caption">山水意象</text>
    </g>
  );
}
