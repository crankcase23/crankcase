"use client";

import { useCurrentMileage } from "@/lib/currentMileage";
import { nextStop, type NextServiceData } from "@/lib/nextService";
import Section from "@/components/app/Section";
import { PANEL } from "@/components/app/Chapter";
import { display } from "@/components/app/AppKit";


// ONE useful tile instead of the whole factory grid: the next mileage the
// manufacturer asks for service at, from the owner's current mileage. The full
// grid is still there, behind a secondary "View full factory schedule" control.
export default function ManufacturerService({
  vehicleId,
  data,
  sourceLabel,
  fullSchedule,
}: {
  vehicleId: string;
  data: NextServiceData;
  sourceLabel: string;
  fullSchedule: React.ReactNode;
}) {
  const { miles, source } = useCurrentMileage(vehicleId);
  const stop = miles != null ? nextStop(data.stops, miles) : null;

  const summary =
    miles == null
      ? "Log your mileage to see what's next"
      : stop
        ? `Next service around ${stop.miles.toLocaleString("en-US")} mi`
        : "Past the last published interval";

  return (
    <Section
      id="service"
      vehicleId={vehicleId}
      eyebrow="By the book"
      title="Manufacturer Service"
      summary={summary}
      defaultOpen
      glow="right"
      opensOn={["maintenance", "factory-schedule"]}
    >
      <div className={`${PANEL} relative isolate overflow-hidden p-6 sm:p-8`}>
        {/* faint bench photo bleeding in from the right, heavily graded */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          aria-hidden
          alt=""
          src="/images/garage/workshop-bench.jpg"
          loading="lazy"
          className="pointer-events-none absolute inset-y-0 right-0 -z-10 h-full w-3/5 max-w-none object-cover opacity-[0.22] [mask-image:linear-gradient(to_right,transparent,black_70%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-24 -z-10 h-72 w-[30rem] bg-[radial-gradient(closest-side,rgba(251,146,60,0.2),transparent)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_90%_at_18%_45%,rgba(0,0,0,0.55),transparent_75%)]"
        />
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
          Next manufacturer-recommended service
        </p>
        {miles == null ? (
          <div className="mt-3 max-w-xl">
            <p className="text-lg leading-snug text-slate-100">
              Log your mileage to see your next manufacturer-recommended service.
            </p>
            <a
              href="#odo"
              className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-white/20 bg-black/30 px-5 text-sm font-semibold text-slate-100 hover:border-white/50"
            >
              Add mileage
            </a>
          </div>
        ) : stop ? (
          <div className="mt-2">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-6xl font-extrabold leading-none text-orange-400 drop-shadow-[0_0_26px_rgba(251,146,60,0.28)] sm:text-7xl" style={display}>
                {stop.miles.toLocaleString("en-US")}
                <span className="ml-2 text-3xl text-orange-300/80 sm:text-4xl">mi</span>
              </span>
              <span className="font-mono text-sm text-slate-400">
                {(stop.miles - miles).toLocaleString("en-US")} mi to go
              </span>
            </div>
            <ul className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-[0.95rem] text-slate-200">
              {stop.labels.map((l, i) => (
                <li key={l} className="flex items-center gap-3">
                  {i > 0 ? <span aria-hidden className="text-slate-600">•</span> : null}
                  {l}
                </li>
              ))}
            </ul>
            <p className="mt-4 font-mono text-xs text-slate-500">
              From {miles.toLocaleString("en-US")} mi
              {source === "service" ? " (your last logged service)" : ""} · {sourceLabel}
            </p>
          </div>
        ) : (
          <p className="mt-3 max-w-xl text-lg leading-snug text-slate-100">
            You&apos;re past the last interval this schedule publishes. See the full factory schedule below.
          </p>
        )}
        {data.notes.length > 0 ? (
          <ul className="mt-5 space-y-1 border-t border-white/[0.07] pt-4 text-xs leading-relaxed text-slate-500">
            {data.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <details className="group mt-5" id="factory-schedule">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-white/15 bg-black/30 px-5 text-sm font-semibold text-slate-200 hover:border-white/40 [&::-webkit-details-marker]:hidden">
          View full factory schedule
          <span aria-hidden className="text-slate-500 transition group-open:rotate-90">›</span>
        </summary>
        <div className="mt-6">{fullSchedule}</div>
      </details>
    </Section>
  );
}
