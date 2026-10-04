"use client";

import Link from "next/link";
import { mutate as globalMutate } from "swr";
import { findVehicle } from "@/lib/data";
import { useGarage } from "@/lib/garage";
import GarageVehicleCard from "@/components/app/GarageVehicleCard";
import { AppPageHeader, ArrowLink, BTN_PRIMARY, BTN_SECONDARY, Eyebrow, FOCUS, Stamp, display } from "@/components/app/AppKit";
import { IconArrowRight, IconCar, VehicleLinework } from "@/components/marketing/HomeVisuals";

// My Garage -- the signed-in home. Same product behavior as before (list the
// user's vehicles, add, remove, fall through to the VIN lookup); the
// presentation is the approved homepage system, laid out per the Garage
// mockup: identity header, a grid of vehicle panels, the "Add a vehicle" card
// always last. Empty, loading and error states are written in plain garage
// language and never blame the user.

const GARAGE_KEY = "/api/garage";

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SkeletonCard() {
  return (
    <div className="cg-panel overflow-hidden rounded-2xl" aria-hidden>
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/50 px-5 py-3">
        <div className="h-9 w-9 rounded-md bg-slate-800/80 motion-safe:animate-pulse" />
        <div className="h-6 w-24 rounded-full bg-slate-800/80 motion-safe:animate-pulse" />
      </div>
      <div className="space-y-3 px-5 py-5">
        <div className="h-3 w-24 rounded bg-slate-800/80 motion-safe:animate-pulse" />
        <div className="h-8 w-3/4 rounded bg-slate-800/80 motion-safe:animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-slate-800/80 motion-safe:animate-pulse" />
        <div className="cg-well h-12 rounded-lg" />
      </div>
      <div className="h-[49px] border-t border-slate-800" />
    </div>
  );
}

export default function GarageClient() {
  const { entries, removeEntry, isLoading, error } = useGarage();

  const count = entries.length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
      <AppPageHeader
        eyebrow="Your ride. Your garage. Your wrenches."
        title="My Garage"
        lede="Pick a vehicle to see its fluid capacities, specs, and step-by-step repair guides with tools and torque values."
        actions={
          <>
            {!isLoading && !error && count > 0 ? (
              <Stamp>
                {count} {count === 1 ? "vehicle" : "vehicles"}
              </Stamp>
            ) : null}
            <Link href="/garage/add" className={BTN_PRIMARY}>
              <PlusIcon className="h-4 w-4" />
              Add a vehicle
            </Link>
          </>
        }
      />

      <div className="mt-9">
        {error ? (
          <section role="alert" className="cg-panel rounded-2xl p-8 text-center sm:p-10">
            <Eyebrow>Couldn&apos;t reach your garage</Eyebrow>
            <h2 className="mt-3 text-2xl font-extrabold uppercase text-slate-50" style={display}>
              Your vehicles didn&apos;t load
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">
              That&apos;s on our end, not yours. Nothing was changed or removed. Give it another go.
            </p>
            <button type="button" onClick={() => globalMutate(GARAGE_KEY)} className={`mt-5 ${BTN_SECONDARY}`}>
              Try again
            </button>
          </section>
        ) : isLoading ? (
          <section aria-label="Loading your garage" aria-busy="true" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </section>
        ) : count === 0 ? (
          <section className="cg-panel relative isolate overflow-hidden rounded-2xl">
            <div className="cg-grid pointer-events-none absolute inset-0 -z-10 opacity-70 [mask-image:radial-gradient(ellipse_at_70%_100%,black,transparent_70%)]" aria-hidden />
            <VehicleLinework
              tonal
              className="pointer-events-none absolute -bottom-6 -right-10 -z-10 w-[34rem] max-w-none text-slate-300 opacity-[0.18] sm:right-0 sm:opacity-[0.28]"
            />
            <div className="px-6 py-12 sm:px-10 sm:py-16">
              <Eyebrow>No vehicles yet</Eyebrow>
              <h2 className="mt-3 max-w-md text-4xl font-extrabold uppercase leading-[0.95] text-slate-50 sm:text-5xl" style={display}>
                Your garage is empty
              </h2>
              <p className="mt-4 max-w-md text-slate-300">
                Add a vehicle to start seeing its specs, fluid capacities, and repair guides — or to just track service
                history.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href="/garage/add" className={BTN_PRIMARY}>
                  <IconCar className="h-5 w-5" />
                  + Add your first vehicle
                  <IconArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/decode" className={BTN_SECONDARY}>
                  Try the VIN lookup
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <section aria-label="Your vehicles" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((e) => {
              if (e.kind === "catalog") {
                const vehicle = findVehicle(e.id);
                if (!vehicle) return null;
                return <GarageVehicleCard key={e.id} id={e.id} kind="catalog" vehicle={vehicle} onRemove={() => removeEntry(e.id)} />;
              }
              return <GarageVehicleCard key={e.id} id={e.id} kind="custom" custom={e.custom} onRemove={() => removeEntry(e.id)} />;
            })}

            <Link
              href="/garage/add"
              className={`group flex min-h-[18rem] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/30 p-6 text-center transition-colors hover:border-orange-500/60 hover:bg-slate-900/60 ${FOCUS}`}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-orange-400 group-hover:border-orange-500/60">
                <PlusIcon className="h-6 w-6" />
              </span>
              <span className="text-2xl font-extrabold uppercase text-slate-50" style={display}>
                Add a vehicle
              </span>
              <span className="max-w-[16rem] text-sm text-slate-400">
                Enter a VIN or pick year, make and model. Your garage is free and unlimited.
              </span>
            </Link>
          </section>
        )}
      </div>

      <section className="cg-well mt-10 rounded-2xl p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-100">Don&apos;t see your vehicle?</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          This is an early build — full guides only exist for a handful of vehicles so far. You can still add any
          vehicle to log its service history, and decode a VIN for basic year/make/model info.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          <ArrowLink href="/garage/add">Add a vehicle</ArrowLink>
          <ArrowLink href="/decode">Try the VIN lookup</ArrowLink>
        </div>
      </section>
    </div>
  );
}
