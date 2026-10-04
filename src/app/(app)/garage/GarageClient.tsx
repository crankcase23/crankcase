"use client";

import Link from "next/link";
import { mutate as globalMutate } from "swr";
import { findVehicle } from "@/lib/data";
import { useGarage } from "@/lib/garage";
import GarageVehicleCard from "@/components/app/GarageVehicleCard";
import { BTN_PRIMARY, BTN_SECONDARY, Eyebrow, FOCUS, display } from "@/components/app/AppKit";
import { PhotoScene } from "@/components/marketing/Cinematic";
import { IconArrowRight, IconCar } from "@/components/marketing/HomeVisuals";

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
    <div className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#080d15]/80" aria-hidden>
      <div className="h-48 bg-white/[0.04] motion-safe:animate-pulse" />
      <div className="space-y-3 px-5 py-5">
        <div className="h-3 w-12 rounded bg-white/[0.06]" />
        <div className="h-8 w-3/4 rounded bg-white/[0.06]" />
        <div className="h-3 w-1/2 rounded bg-white/[0.06]" />
        <div className="h-12 rounded-lg bg-white/[0.06]" />
      </div>
    </div>
  );
}

/** Dark workshop backdrop from the real hero photograph: the tool wall, no car. */
function WorkshopBackdrop({ pos = "18% 28%", scale = "scale-[2.4]" }: { pos?: string; scale?: string }) {
  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden bg-[#06090f]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/home/hero-garage.jpg" alt="" className={`absolute inset-0 h-full w-full origin-top-left object-cover opacity-95 ${scale}`} style={{ objectPosition: pos }} loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#06090f]/90 via-[#06090f]/55 to-[#06090f]/15" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#06090f]/80 to-transparent" />
    </div>
  );
}

export default function GarageClient() {
  const { entries, removeEntry, isLoading, error } = useGarage();

  const count = entries.length;

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-white/[0.06]">
        <PhotoScene src="/images/home/hero-garage.jpg" position="50% 40%" shift="12%" />
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-12 sm:pb-16 sm:pt-16">
          <Eyebrow>Your ride. Your garage.</Eyebrow>
          <h1 className="mt-3 text-6xl font-extrabold uppercase leading-[0.92] text-slate-50 sm:text-7xl" style={display}>
            My <span className="text-orange-500">Garage</span>
          </h1>
          <p className="mt-4 max-w-md text-base text-slate-200 sm:text-lg">
            All your vehicles in one place. Check specs, guides, service history, and keep track of what&apos;s next.
          </p>
        </div>
      </section>

    <div className="mx-auto max-w-6xl px-4 pb-12 pt-9 sm:pb-14">
      <div>
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
          <section className="relative isolate overflow-hidden rounded-2xl border border-white/10">
            <WorkshopBackdrop />
            <div className="px-6 py-14 sm:px-10 sm:py-20">
              <Eyebrow>No vehicles yet</Eyebrow>
              <h2 className="mt-3 max-w-md text-4xl font-extrabold uppercase leading-[0.95] text-slate-50 sm:text-5xl" style={display}>
                Your garage is empty
              </h2>
              <p className="mt-4 max-w-md text-slate-200">
                Add a vehicle to start seeing its specs, fluid capacities, and repair guides — or to just track service
                history.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href="/garage/add" className={BTN_PRIMARY}>
                  <IconCar className="h-5 w-5" />
                  Add your first vehicle
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
              className={`group relative isolate flex min-h-[22rem] flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/[0.12] p-6 text-center transition-colors hover:border-white/30 ${FOCUS}`}
            >
              <WorkshopBackdrop pos="30% 30%" />
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-orange-500/70 bg-black/30 text-orange-400">
                <PlusIcon className="h-7 w-7" />
              </span>
              <span className="text-3xl font-extrabold text-slate-50" style={display}>
                Add a vehicle
              </span>
              <span className="max-w-[16rem] text-sm text-slate-200">
                Enter a VIN or select manually to add a new vehicle to your garage.
              </span>
              <span className="mt-1 rounded-lg border border-white/25 bg-black/30 px-5 py-2 text-sm font-semibold text-slate-50 group-hover:border-white/50">
                Add a vehicle <span aria-hidden>&rarr;</span>
              </span>
            </Link>

            <section className="relative isolate flex min-h-[22rem] flex-col justify-center overflow-hidden rounded-2xl border border-white/[0.12] p-7 sm:col-span-2 sm:p-9">
              <WorkshopBackdrop pos="55% 38%" scale="scale-[2]" />
              <h2 className="text-2xl font-extrabold text-slate-50" style={display}>
                Don&apos;t see your vehicle?
              </h2>
              <p className="mt-3 max-w-md text-slate-200">
                We&apos;re constantly adding vehicles and guides. Add yours now so it&apos;s already in your garage as
                coverage expands.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/garage/add" className={BTN_PRIMARY}>
                  Add a vehicle <span aria-hidden>&rarr;</span>
                </Link>
                <Link href="/decode" className={BTN_SECONDARY}>
                  Try the VIN lookup <span aria-hidden>&rarr;</span>
                </Link>
              </div>
            </section>
          </section>
        )}
      </div>

    </div>
    </>
  );
}
