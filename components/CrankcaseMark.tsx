// The "Sump Mark" — Crankcase's icon. Drawn from the actual crankcase oil
// pan: the pentagon is the pan-plus-sump silhouette, the five dots are the
// bolts that seal it to the block along the top flange, and the hex at the
// tip is the drain plug. See the logo concept review for the other two
// directions that were considered (Bolt Ring Badge, Torque Arc).
export default function CrankcaseMark({
  panFill = "#f97316",
  accentFill = "#0f172a",
  className,
}: {
  panFill?: string;
  accentFill?: string;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 160 160" className={className} aria-hidden="true">
      <polygon points="24,40 136,40 104,84 80,128 56,84" fill={panFill} />
      <line x1="56" y1="84" x2="104" y2="84" stroke={accentFill} strokeWidth={3} />
      <circle cx="32" cy="40" r="5" fill={accentFill} />
      <circle cx="56" cy="40" r="5" fill={accentFill} />
      <circle cx="80" cy="40" r="5" fill={accentFill} />
      <circle cx="104" cy="40" r="5" fill={accentFill} />
      <circle cx="128" cy="40" r="5" fill={accentFill} />
      <g transform="translate(80,131)">
        <polygon
          points="9,0 4.5,7.8 -4.5,7.8 -9,0 -4.5,-7.8 4.5,-7.8"
          fill={accentFill}
        />
      </g>
    </svg>
  );
}
