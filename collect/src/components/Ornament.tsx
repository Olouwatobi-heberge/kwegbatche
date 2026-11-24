export default function Ornament() {
  return (
    <div className="ornament" aria-hidden="true">
      <svg className="ornament-band" viewBox="0 0 1200 160" preserveAspectRatio="none">
        <g fill="none" stroke="currentColor" strokeWidth="0.8">
          <path d="M0 40 C 80 10, 160 70, 240 40 S 400 10, 480 40 S 640 70, 720 40 S 880 10, 960 40 S 1120 70, 1200 40" />
          <path d="M0 70 C 80 40, 160 100, 240 70 S 400 40, 480 70 S 640 100, 720 70 S 880 40, 960 70 S 1120 100, 1200 70" />
          <path d="M0 100 C 80 70, 160 130, 240 100 S 400 70, 480 100 S 640 130, 720 100 S 880 70, 960 100 S 1120 130, 1200 100" />
        </g>
        <g fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.75">
          <path d="M0 55 C 100 25, 180 85, 280 55 S 460 25, 560 55 S 740 85, 840 55 S 1020 25, 1200 55" />
          <path d="M0 85 C 100 115, 180 55, 280 85 S 460 115, 560 85 S 740 55, 840 85 S 1020 115, 1200 85" />
        </g>
      </svg>
      <svg className="rosette rosette-a" viewBox="0 0 200 200">
        <g fill="none" stroke="currentColor" strokeWidth="0.7">
          <circle cx="100" cy="100" r="18" />
          <circle cx="100" cy="100" r="34" />
          <circle cx="100" cy="100" r="52" />
          <circle cx="100" cy="100" r="72" />
          <circle cx="100" cy="100" r="92" />
          <path d="M100 8 C 150 28, 172 58, 192 100 C 172 142, 150 172, 100 192 C 50 172, 28 142, 8 100 C 28 58, 50 28, 100 8 Z" />
        </g>
        <g fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.7">
          <path d="M100 28 C 138 48, 152 72, 172 100 C 152 128, 138 152, 100 172 C 62 152, 48 128, 28 100 C 48 72, 62 48, 100 28 Z" />
          <path d="M100 46 C 126 62, 138 80, 154 100 C 138 120, 126 138, 100 154 C 74 138, 62 120, 46 100 C 62 80, 74 62, 100 46 Z" />
        </g>
      </svg>
      <svg className="rosette rosette-b" viewBox="0 0 200 200">
        <g fill="none" stroke="currentColor" strokeWidth="0.7">
          <circle cx="100" cy="100" r="22" />
          <circle cx="100" cy="100" r="44" />
          <circle cx="100" cy="100" r="66" />
          <circle cx="100" cy="100" r="88" />
          <path d="M100 12 C 146 36, 164 68, 188 100 C 164 132, 146 164, 100 188 C 54 164, 36 132, 12 100 C 36 68, 54 36, 100 12 Z" />
        </g>
        <g fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.7">
          <path d="M100 36 C 132 54, 146 76, 164 100 C 146 124, 132 146, 100 164 C 68 146, 54 124, 36 100 C 54 76, 68 54, 100 36 Z" />
        </g>
      </svg>
    </div>
  );
}
