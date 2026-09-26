import type { CSSProperties } from "react";

/**
 * Graphite re-skin for the guide experience.
 *
 * Tailwind v4 utilities read their colors from CSS variables, so overriding
 * the slate scale on a wrapper element re-colors everything inside it,
 * INCLUDING the unchanged GuideBody / StepList / RepairStepCard / tables that
 * customer guides share, without editing any of them. Applied only where the
 * guide experience wraps itself; nothing else on the site is affected.
 */
export const GRAPHITE_VARS = {
  "--color-slate-50": "#f7f8f9",
  "--color-slate-100": "#eef0f2",
  "--color-slate-200": "#e1e4e7",
  "--color-slate-300": "#c4c9ce",
  "--color-slate-400": "#9ca2a9",
  "--color-slate-500": "#767c84",
  "--color-slate-600": "#50565d",
  "--color-slate-700": "#383d43",
  "--color-slate-800": "#2a2e33",
  "--color-slate-900": "#1a1d21",
  "--color-slate-950": "#121416",
} as CSSProperties;
