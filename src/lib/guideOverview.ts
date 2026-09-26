import type { ResolvedGuide, Vehicle } from "@/types/vehicle";

/**
 * Pure derivations for the Overall Guide header. Everything is read from the
 * canonical guide/vehicle objects; nothing is stored, invented or rewritten.
 */

export function vehicleTitle(v: Vehicle): string {
  return [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
}

export interface GuideOverview {
  /** Summary text before any "Jobs included:" list. */
  intro: string;
  /** Jobs parsed from a "Jobs included: a; b; c." sentence in the summary. */
  jobs: string[];
  /** e.g. "4–6 hours", when the estimate text leads with a range. */
  timeShort?: string;
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function deriveOverview(guide: ResolvedGuide): GuideOverview {
  const m = /^([\s\S]*?)\s*Jobs included:\s*([\s\S]+?)\.?\s*$/i.exec(guide.summary);
  const intro = m ? m[1].trim() : guide.summary;
  const jobs = m
    ? m[2]
        .split(";")
        .map((j) => j.trim())
        .filter(Boolean)
        .map(cap)
    : [];
  const t = /(\d+(?:\.\d+)?\s*[–-]\s*\d+(?:\.\d+)?\s*hours?)/i.exec(guide.estTime);
  return { intro, jobs, timeShort: t?.[1] };
}

/** 1..3 filled segments for the difficulty meter. */
export function difficultyLevel(d: ResolvedGuide["difficulty"]): number {
  return d === "Easy" ? 1 : d === "Moderate" ? 2 : 3;
}
