"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listVehicles, matchCatalogVehicles } from "@/lib/data";
import { useGarage } from "@/lib/garage";
import { decodeVin, DecodedVin } from "@/lib/vpic";

export default function AddVehiclePage() {
const router = useRouter();
const { entries, addCatalogVehicle, addCustomVehicle } = useGarage();
const catalog = listVehicles();
const inGarage = new Set(entries.filter((e) => e.kind === "catalog").map((e) => e.id));

// --- VIN decode: the primary path (2026-09-19 redesign, see
// claude/crankcase-v1-build-notes.md) — decoding now checks the real
// catalog first, so a matching vehicle routes to its real specs/guides
// instead of always creating a bare custom entry.
const [vin, setVin] = useState("");
const [decoding, setDecoding] = useState(false);
const [decodeError, setDecodeError] = useState<string | null>(null);
const [decoded, setDecoded] = useState<DecodedVin | null>(null);
const [pickedMatchId, setPickedMatchId] = useState<string | null>(null);

const matches = decoded ? matchCatalogVehicles(decoded) : [];

async function handleDecode(e: React.FormEvent) {
e.preventDefault();
setDecodeError(null);
setDecoded(null);
setPickedMatchId(null);
if (vin.trim().length !== 17) {
setDecodeError("VINs are 17 characters — double-check and try again.");
return;
}
setDecoding(true);
try {
const result = await decodeVin(vin);
if (!result.make || !result.model || !result.year) {
setDecodeError(
"Couldn't get a clean read on that VIN — double-check it, or add your vehicle manually below."
);
return;
}
setDecoded(result);
const found = matchCatalogVehicles(result);
if (found.length === 1) setPickedMatchId(found[0].id);
} catch {
setDecodeError(
"Couldn't reach the NHTSA VIN decoder right now. Try again in a moment, or add your vehicle manually below."
);
} finally {
setDecoding(false);
}
}

async function handleAddMatch() {
if (!pickedMatchId) return;
await addCatalogVehicle(pickedMatchId);
router.push(`/vehicles/${pickedMatchId}`);
}

async function handleAddDecodedAsCustom() {
if (!decoded) return;
const engine = [
decoded.displacementL ? `${decoded.displacementL}L` : null,
decoded.engineCylinders ? `${decoded.engineCylinders}-cyl` : null,
]
.filter(Boolean)
.join(" ");
const id = await addCustomVehicle({
vin: decoded.vin,
year: decoded.year,
make: decoded.make,
model: decoded.model,
trim: decoded.trim,
engine: engine || undefined,
});
router.push(`/garage/custom/${id}`);
}

async function handleAddCatalog(id: string) {
await addCatalogVehicle(id);
router.push(`/vehicles/${id}`);
}

// --- Manual entry (fallback, tucked under the details toggle below)
const [year, setYear] = useState("");
const [make, setMake] = useState("");
const [model, setModel] = useState("");
const [trim, setTrim] = useState("");
const [engine, setEngine] = useState("");

async function handleAddCustom(e: React.FormEvent) {
e.preventDefault();
if (!year.trim() && !make.trim() && !model.trim()) return;
const id = await addCustomVehicle({
year: year.trim() || undefined,
make: make.trim() || undefined,
model: model.trim() || undefined,
trim: trim.trim() || undefined,
engine: engine.trim() || undefined,
});
router.push(`/garage/custom/${id}`);
}

return (
<div className="mx-auto max-w-3xl px-4 py-10">
<Link href="/garage" className="text-sm text-slate-400 hover:text-slate-200">
&larr; Back to garage
</Link>

<h1 className="mt-3 text-3xl font-bold text-slate-50">Add a vehicle</h1>
<p className="mt-2 text-slate-400">
Fastest way in: your VIN. We&apos;ll check it against our full guide catalog
first — if we&apos;ve got real specs and torque data for your exact vehicle,
you&apos;ll go straight there.
</p>

{/* PRIMARY: VIN decode */}
<section className="mt-6 rounded-xl border border-orange-500/30 bg-slate-900 p-5">
<h2 className="text-lg font-semibold text-slate-100">Add by VIN</h2>
<p className="mt-1 text-sm text-slate-400">
Free lookup via the NHTSA public database — find your VIN on your
registration, insurance card, or the driver-side door jamb.
</p>
<form onSubmit={handleDecode} className="mt-4 flex gap-2">
<input
value={vin}
onChange={(e) => setVin(e.target.value)}
placeholder="Enter 17-character VIN"
maxLength={17}
className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-slate-100 placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
/>
<button
type="submit"
disabled={decoding}
className="rounded-lg bg-orange-500 px-5 py-2 font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-50"
>
{decoding ? "Decoding…" : "Decode"}
</button>
</form>

{decodeError && (
<div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
{decodeError}
</div>
)}

{decoded && matches.length > 0 && (
<div className="mt-5">
<div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
{matches.length === 1
? "Good news — we have full specs, fluid capacities, and repair guides for this exact vehicle."
: "Good news — we have full guides for this vehicle. Pick your engine:"}
</div>
<div className="mt-3 grid gap-3 sm:grid-cols-2">
{matches.map((v) => (
<button
key={v.id}
type="button"
onClick={() => setPickedMatchId(v.id)}
className={`rounded-xl border p-4 text-left transition ${
pickedMatchId === v.id
? "border-orange-500 bg-slate-800"
: "border-slate-800 bg-slate-900 hover:border-orange-500/50"
}`}
>
<div className="text-xs uppercase tracking-wide text-orange-400 font-semibold">
{v.year}
</div>
<div className="mt-0.5 font-bold text-slate-100">
{v.make} {v.model} {v.trim}
</div>
<div className="mt-1 text-xs text-slate-500">{v.engine}</div>
</button>
))}
</div>
<button
type="button"
onClick={handleAddMatch}
disabled={!pickedMatchId}
className="mt-4 w-full rounded-lg bg-orange-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-50"
>
+ Add to garage
</button>
</div>
)}

{decoded && matches.length === 0 && (
<div className="mt-5">
<dl className="divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-950/60 px-4">
{[
["Year", decoded.year],
["Make", decoded.make],
["Model", decoded.model],
["Trim", decoded.trim],
["Body Class", decoded.bodyClass],
["Cylinders", decoded.engineCylinders],
["Displacement (L)", decoded.displacementL],
["Fuel Type", decoded.fuelType],
["Drive Type", decoded.driveType],
["Transmission", decoded.transmissionStyle],
]
.filter(([, v]) => v)
.map(([label, value]) => (
<div key={label} className="flex justify-between gap-4 py-2 text-sm">
<dt className="text-slate-400">{label}</dt>
<dd className="text-right font-medium text-slate-100">{value}</dd>
</div>
))}
</dl>
<p className="mt-3 text-sm text-slate-400">
We don&apos;t have curated specs or torque data for this one yet — you
can still add it and track service history and maintenance reminders
on it.
</p>
<button
type="button"
onClick={handleAddDecodedAsCustom}
className="mt-3 w-full rounded-lg bg-orange-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-orange-400"
>
+ Add this vehicle to my garage
</button>
</div>
)}
</section>

{/* SECONDARY: browse the catalog or enter manually, collapsed by default */}
<details className="mt-8">
<summary className="cursor-pointer text-sm font-medium text-slate-400 hover:text-slate-200">
Don&apos;t have your VIN handy? Browse the catalog or enter details manually
</summary>

<section className="mt-5">
<h2 className="mb-3 text-lg font-semibold text-slate-100">
Vehicles with full guides
</h2>
<div className="grid gap-3 sm:grid-cols-2">
{catalog.map((v) => {
const already = inGarage.has(v.id);
return (
<button
key={v.id}
type="button"
disabled={already}
onClick={() => handleAddCatalog(v.id)}
className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-left transition enabled:hover:border-orange-500 enabled:hover:bg-slate-800/80 disabled:cursor-not-allowed disabled:opacity-50"
>
<div className="text-xs uppercase tracking-wide text-orange-400 font-semibold">
{v.year}
</div>
<div className="mt-0.5 font-bold text-slate-100">
{v.make} {v.model} {v.trim}
</div>
<div className="mt-1 text-xs text-slate-500">{v.engine}</div>
<div className="mt-2 text-xs font-medium text-orange-400">
{already ? "Already in your garage" : "+ Add to garage"}
</div>
</button>
);
})}
</div>
</section>

<section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
<h2 className="text-lg font-semibold text-slate-100">Still don&apos;t see it?</h2>
<p className="mt-1 text-sm text-slate-400">
Add it anyway. We won&apos;t have curated specs or torque data for it
yet, but you can still log service history and get maintenance
reminders.
</p>
<form onSubmit={handleAddCustom} className="mt-4 grid gap-3 sm:grid-cols-2">
<div>
<label htmlFor="year" className="mb-1 block text-xs text-slate-400">Year</label>
<input
id="year"
value={year}
onChange={(e) => setYear(e.target.value)}
placeholder="2016"
className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
/>
</div>
<div>
<label htmlFor="make" className="mb-1 block text-xs text-slate-400">Make</label>
<input
id="make"
value={make}
onChange={(e) => setMake(e.target.value)}
placeholder="Toyota"
className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
/>
</div>
<div>
<label htmlFor="model" className="mb-1 block text-xs text-slate-400">Model</label>
<input
id="model"
value={model}
onChange={(e) => setModel(e.target.value)}
placeholder="Tacoma"
className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
/>
</div>
<div>
<label htmlFor="trim" className="mb-1 block text-xs text-slate-400">Trim (optional)</label>
<input
id="trim"
value={trim}
onChange={(e) => setTrim(e.target.value)}
placeholder="TRD Off-Road"
className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
/>
</div>
<div className="sm:col-span-2">
<label htmlFor="engine" className="mb-1 block text-xs text-slate-400">Engine (optional)</label>
<input
id="engine"
value={engine}
onChange={(e) => setEngine(e.target.value)}
placeholder="3.5L V6"
className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
/>
</div>
<div className="sm:col-span-2">
<button
type="submit"
className="rounded-lg bg-orange-500 px-5 py-2.5 font-semibold text-slate-950 hover:bg-orange-400"
>
Add to garage
</button>
</div>
</form>
</section>
</details>
</div>
);
}
