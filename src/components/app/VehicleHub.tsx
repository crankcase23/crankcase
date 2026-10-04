"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useOdometer } from "@/lib/odometer";
import { useServiceHistory } from "@/lib/serviceHistory";
import { computeReminders, type MaintenanceItem, type ReminderResult } from "@/lib/reminders";
import { IconWrench, IconClock } from "@/components/marketing/HomeVisuals";
import { IconAlert, IconCheck, IconDrop, IconSearch } from "@/components/app/AppIcons";
import { FOCUS, display } from "@/components/app/AppKit";
import { FreeChip, KeysChip } from "@/components/app/KeysUi";

// Vehicle Home: "What are we doing today?" plus the two side panels. Layout is
// the approved Vehicle Home mockup (clutch/26 board 2) in the homepage design
// system. Everything shown is real: the user's odometer, their service log, and
// the reminders computeReminders() already produces from them. Tile chips mark
// the approved Free / Keys split and are visual only (see KeysUi.tsx).

export type HubTileKey = "maintain" | "fix" | "history" | "info";

export interface HubTile {
  key: HubTileKey;
  title: string;
  body: string;
  href: string;
  gate: "free" | "keys";
}

const TILE_ICON: Record<HubTileKey, React.ReactNode> = {
  maintain: <IconDrop className="h-7 w-7" />,
  fix: <IconWrench className="h-7 w-7" />,
  history: <IconClock className="h-7 w-7" />,
  info: <IconSearch className="h-7 w-7" />,
};

function ActionTile({ tile }: { tile: HubTile }) {
  return (
    <Link
      href={tile.href}
      className={`vh-panel group relative flex min-h-[9.5rem] flex-col gap-3 overflow-hidden rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-white/25 ${FOCUS}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-orange-300/90 drop-shadow-[0_0_10px_rgba(251,146,60,0.35)]">{TILE_ICON[tile.key]}</span>
        {tile.gate === "free" ? <FreeChip /> : <KeysChip />}
      </div>
      <div className="text-3xl font-extrabold uppercase leading-none text-slate-50" style={display}>
        {tile.title}
      </div>
      <p className="text-sm leading-snug text-slate-400">{tile.body}</p>
    </Link>
  );
}

function milesWord(n: number) {
  const r = n >= 100 ? Math.round(n / 50) * 50 : Math.max(50, Math.round(n / 10) * 10);
  return r.toLocaleString("en-US");
}

function attentionRow(r: ReminderResult): { tone: "overdue" | "soon" | "ok"; sub: string } {
  if (r.status === "overdue")
    return {
      tone: "overdue",
      sub: r.dueMilesRemaining != null ? `Overdue by about ${milesWord(Math.abs(r.dueMilesRemaining))} mi.` : "Overdue.",
    };
  if (r.status === "due-soon")
    return {
      tone: "soon",
      sub: r.dueMilesRemaining != null ? `Due in about ${milesWord(r.dueMilesRemaining)} mi.` : r.dueDate ? `Due ${r.dueDate}.` : "Due soon.",
    };
  return { tone: "ok", sub: "On schedule." };
}

export function HubSidePanels({
  vehicleId,
  items,
  maintainHref,
  historyHref,
}: {
  vehicleId: string;
  items?: MaintenanceItem[];
  maintainHref: string;
  historyHref: string;
}) {
  const { odometer } = useOdometer(vehicleId);
  const { entries } = useServiceHistory(vehicleId);

  const rows = useMemo(() => {
    const results = computeReminders(entries, odometer, items);
    const urgent = results
      .filter((r) => r.status === "overdue" || r.status === "due-soon")
      .sort((a, b) => (a.dueMilesRemaining ?? 0) - (b.dueMilesRemaining ?? 0));
    const oks = results.filter((r) => r.status === "ok");
    return [...urgent, ...oks].slice(0, 4);
  }, [entries, odometer, items]);

  const recent = useMemo(
    () =>
      entries
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.loggedAt.localeCompare(a.loggedAt)))
        .slice(0, 3),
    [entries],
  );

  const toneClass = { overdue: "text-orange-400", soon: "text-orange-400", ok: "text-emerald-400" };

  return (
    <div className="flex flex-col gap-5">
      <section className="vh-panel rounded-2xl p-5" aria-labelledby="hub-attention">
        <h2 id="hub-attention" className="cg-section-title">
          What needs attention
        </h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Nothing logged to track yet. Log your last oil change and Crankcase Garage starts working out what&apos;s due.
          </p>
        ) : (
          <ul className="mt-3">
            {rows.map((r) => {
              const row = attentionRow(r);
              return (
                <li key={r.item.key} className="flex gap-3 border-t border-white/[0.07] py-3.5">
                  <span className={`mt-0.5 shrink-0 ${toneClass[row.tone]}`}>
                    {row.tone === "ok" ? <IconCheck className="h-5 w-5" /> : <IconAlert className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-100">{r.item.label}</div>
                    <div className="mt-0.5 text-sm text-slate-400">{row.sub}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Link
          href={maintainHref}
          className={`mt-3 flex w-full items-center justify-center rounded-lg border border-white/20 bg-black/30 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:border-white/50 hover:text-white ${FOCUS}`}
        >
          See full schedule
        </Link>
      </section>

      <section className="vh-panel rounded-2xl p-5" aria-labelledby="hub-recent">
        <h2 id="hub-recent" className="cg-section-title">
          Recent work
        </h2>
        <p className="cg-stamp mt-2 normal-case tracking-wide">user-recorded Crankcase Service History</p>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            No service logged yet.{" "}
            <Link href={historyHref} className="font-medium text-orange-400 hover:text-orange-300">
              Log your first job
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3">
            {recent.map((e) => (
              <li key={e.id} className="flex gap-3 border-t border-white/[0.07] py-3.5">
                <span className="mt-0.5 shrink-0 text-slate-400">
                  <IconWrench className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-100 [overflow-wrap:anywhere]">{e.title}</div>
                  <div className="mt-0.5 font-mono text-xs text-slate-400">
                    {new Date(`${e.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {" · "}
                    {e.mileage.toLocaleString("en-US")} mi
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function HubTiles({ tiles }: { tiles: HubTile[] }) {
  return (
    <section aria-labelledby="hub-today">
      <h2 id="hub-today" className="cg-section-title !text-[2.4rem] sm:!text-[3.1rem]">
        What are we doing today?
      </h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {tiles.map((t) => (
          <ActionTile key={t.key} tile={t} />
        ))}
      </div>
    </section>
  );
}

/** Mileage line for the header: the saved reading, or an invitation to set one. */
export function OdometerLine({ vehicleId, href }: { vehicleId: string; href: string }) {
  const { odometer } = useOdometer(vehicleId);
  return (
    <Link href={href} className={`inline-flex items-center gap-1.5 font-mono text-sm text-slate-300 hover:text-white ${FOCUS}`}>
      <IconClock className="h-4 w-4 text-slate-500" />
      {odometer != null ? `${odometer.toLocaleString("en-US")} mi` : "Mileage not set"}
      <span className="font-sans text-slate-500">· {odometer != null ? "update" : "add mileage"}</span>
    </Link>
  );
}
