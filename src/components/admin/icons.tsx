// Inline stroke icons for the admin nav and panels. Hand-drawn 24x24 paths
// rather than an icon package -- the set is small and fixed, and the brief
// said not to add unnecessary dependencies. All share one visual weight
// (1.6 stroke, round caps) so the nav reads as one family.

export type IconName =
  | "command"
  | "users"
  | "vehicle"
  | "guide"
  | "content"
  | "revenue"
  | "analytics"
  | "system"
  | "shield"
  | "alert"
  | "search"
  | "bell"
  | "menu"
  | "close"
  | "chevronLeft"
  | "logout"
  | "external";

const PATHS: Record<IconName, React.ReactNode> = {
  // Gauge / dashboard
  command: (
    <>
      <path d="M12 21a9 9 0 1 1 9-9" />
      <path d="M12 12l5-3" />
      <circle cx="12" cy="12" r="1.4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 5.5a3.2 3.2 0 0 1 0 5.6M17.5 20a5.6 5.6 0 0 0-2-4.3" />
    </>
  ),
  // Simple car silhouette
  vehicle: (
    <>
      <path d="M5 16h14M4 16v-3.2l1.7-4A2 2 0 0 1 7.6 7.5h8.8a2 2 0 0 1 1.9 1.3l1.7 4V16" />
      <path d="M5.5 12.5h13" />
      <circle cx="7.5" cy="17.5" r="1.5" />
      <circle cx="16.5" cy="17.5" r="1.5" />
    </>
  ),
  // Wrench
  guide: (
    <>
      <path d="M15.2 4.8a4.5 4.5 0 0 0-5.9 5.6L4 15.7 6.3 18l5.3-5.3a4.5 4.5 0 0 0 5.6-5.9l-2.3 2.3-2.1-.6-.6-2.1z" />
    </>
  ),
  content: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8M8 13h8M8 17h4" />
    </>
  ),
  revenue: (
    <>
      <path d="M4 18V7M4 18h16" />
      <path d="M8 15l3.5-4 3 2.5L20 8" />
    </>
  ),
  analytics: (
    <>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <rect x="7.5" y="12" width="3" height="5" rx="0.8" />
      <rect x="13" y="8" width="3" height="9" rx="0.8" />
    </>
  ),
  system: (
    <>
      <rect x="3" y="5" width="18" height="6" rx="1.6" />
      <rect x="3" y="13" width="18" height="6" rx="1.6" />
      <path d="M7 8h.01M7 16h.01" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5.5c0 4.2-2.9 7.6-7 9.5-4.1-1.9-7-5.3-7-9.5V6z" />
      <path d="M9.5 12l1.8 1.8 3.3-3.6" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4.5 2.8 20h18.4z" />
      <path d="M12 10v4.2M12 17.2h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M15.5 15.5 20 20" />
    </>
  ),
  bell: (
    <>
      <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5s1.5-1.5 1.5-5.5z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevronLeft: <path d="M14 6l-6 6 6 6" />,
  logout: (
    <>
      <path d="M14 4h3.5A1.5 1.5 0 0 1 19 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" />
      <path d="M10 8l-4 4 4 4M6 12h9" />
    </>
  ),
  external: (
    <>
      <path d="M14 5h5v5" />
      <path d="M19 5l-7 7" />
      <path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
    </>
  ),
};

export function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
