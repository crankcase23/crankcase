import type { ReactNode } from "react";

/**
 * Small inline icon set for the guide experience. No dependency: each icon is
 * a stroke path on a 24px grid, drawn to sit with the Crankcase orange/graphite
 * look. All are decorative (aria-hidden); the control that contains one always
 * carries its own text label or aria-label.
 */

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

/**
 * The Wrench Mode wrench. Open-end jaw on the left, handle to the right. The
 * "right" direction is the SAME asset mirrored, so direction is carried by
 * the jaw/head end of the wrench itself, not by an added arrow.
 */
export function WrenchIcon({
  direction = "left",
  className = "",
}: {
  direction?: "left" | "right";
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={direction === "right" ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M9.5 6.64 A7 7 0 1 1 9.5 17.36" />
      <path d="M21 12 H43" />
    </svg>
  );
}

export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);
export const LayersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 3 8l9 5 9-5-9-5Z" />
    <path d="m3 13 9 5 9-5" />
    <path d="m3 17.5 9 5 9-5" />
  </Svg>
);
export const ToolsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14.7 6.3a4 4 0 0 0 5 5L11 20a2.1 2.1 0 0 1-3-3l8.7-8.7Z" />
    <path d="m5 5 3 3" />
    <path d="M3.5 6.5 6.5 3.5" />
  </Svg>
);
export const PlayIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className={className}>
    <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" />
  </svg>
);
export const ExitIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </Svg>
);
export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Svg>
);
export const CarIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 11 1.6-4.2A2 2 0 0 1 8.5 5.5h7a2 2 0 0 1 1.9 1.3L19 11" />
    <path d="M3 17v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4" />
    <path d="M5 17v2M19 17v2M3 17h18" />
    <circle cx="7.5" cy="14" r=".6" fill="currentColor" />
    <circle cx="16.5" cy="14" r=".6" fill="currentColor" />
  </Svg>
);
export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 10h18" />
  </Svg>
);
export const GaugeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 17a9 9 0 1 1 16 0" />
    <path d="m12 14 4-5" />
    <circle cx="12" cy="14" r="1" fill="currentColor" />
  </Svg>
);
export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);
export const ChevronDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);
export const SaveIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M8 3v5h7V3M8 21v-7h8v7" />
  </Svg>
);

/** Solid orange disc with a dark check: "included / done" marker. */
export function OrangeCheck({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
      <circle cx="12" cy="12" r="11" fill="#f97316" />
      <path d="m7 12.5 3.4 3.4L17.2 9" fill="none" stroke="#111315" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Large ring-and-check used at the top of the completion sheet. */
export function CompleteBadge({ className = "h-16 w-16" }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={className}>
      <circle cx="32" cy="32" r="29" fill="rgba(249,115,22,0.10)" stroke="#f97316" strokeWidth={3} />
      <path d="m20 33 8.5 8.5L44.5 24" fill="none" stroke="#f97316" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
