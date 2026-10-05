// Small stroke icons for the signed-in app, same construction as the homepage
// set in marketing/HomeVisuals.tsx (24x24, stroke 1.6, currentColor, aria-hidden).
// Kept separate so the approved homepage file stays untouched.

type P = { className?: string };

function Base({ className, children }: P & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

export const IconDrop = (p: P) => (
  <Base {...p}>
    <path d="M12 2.7s7 6.3 7 11.3a7 7 0 0 1-14 0c0-5 7-11.3 7-11.3z" />
  </Base>
);
export const IconSearch = (p: P) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </Base>
);
export const IconLock = (p: P) => (
  <Base {...p}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Base>
);
export const IconAlert = (p: P) => (
  <Base {...p}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </Base>
);
export const IconCheck = (p: P) => (
  <Base {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Base>
);
export const IconChevronLeft = (p: P) => (
  <Base {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Base>
);
export const IconPrinter = (p: P) => (
  <Base {...p}>
    <path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
    <rect x="7" y="14" width="10" height="7" />
  </Base>
);
