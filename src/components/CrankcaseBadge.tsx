// The combined Crankcase Garage badge — Sump Mark icon and wordmark locked
// into one graphic on a shared navy/orange background. Replaces the old
// separate icon-box + text lockup in the header and footer.
export default function CrankcaseBadge({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 430 100" className={className} role="img" aria-label="Crankcase Garage">
      <rect x="4" y="4" width="422" height="92" rx="20" fill="#0f172a" stroke="#f97316" strokeWidth={4} />
      <g transform="translate(22,14) scale(0.4)">
        <polygon points="24,40 136,40 104,84 80,128 56,84" fill="#f97316" />
        <line x1="56" y1="84" x2="104" y2="84" stroke="#0f172a" strokeWidth={6} />
        <circle cx="32" cy="40" r={7} fill="#0f172a" />
        <circle cx="56" cy="40" r={7} fill="#0f172a" />
        <circle cx="80" cy="40" r={7} fill="#0f172a" />
        <circle cx="104" cy="40" r={7} fill="#0f172a" />
        <circle cx="128" cy="40" r={7} fill="#0f172a" />
        <g transform="translate(80,131)">
          <polygon points="11,0 5.5,9.5 -5.5,9.5 -11,0 -5.5,-9.5 5.5,-9.5" fill="#0f172a" />
        </g>
      </g>
      {/*
        textLength pins the wordmark to a fixed width so it can never run into
        the GARAGE chip at x=262. Without it, this text is laid out by whatever
        font actually renders -- and if Big Shoulders Display is slow, blocked,
        or fails to load, the fallback is far wider and the two overlap. The
        --font-display also lists condensed fallbacks (see globals.css) so a
        substitute needs less squeezing and stays closer to the real mark.
        lengthAdjust="spacingAndGlyphs" keeps the letterforms proportional
        rather than just squeezing the gaps.
      */}
      <text
        x={90}
        y={62}
        style={{ fontFamily: "var(--font-display)" }}
        fontWeight={800}
        fontSize={34}
        letterSpacing={0.5}
        textLength={162}
        lengthAdjust="spacingAndGlyphs"
        fill="#f8fafc"
      >
        CRANKCASE
      </text>
      <rect x={262} y={33} width={140} height={34} rx={7} fill="none" stroke="#f97316" strokeWidth={2} />
      <text
        x={332}
        y={58}
        textAnchor="middle"
        style={{ fontFamily: "var(--font-display)" }}
        fontWeight={700}
        fontSize={22}
        letterSpacing={2}
        textLength={104}
        lengthAdjust="spacingAndGlyphs"
        fill="#f97316"
      >
        GARAGE
      </text>
    </svg>
  );
}
