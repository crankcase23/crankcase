"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { matchCatalogVehicles } from "@/lib/data";
import { getVehicleMakes, getVehicleModels } from "@/lib/vpicBrowse";
import { useGarage } from "@/lib/garage";
import { decodeVin, DecodedVin } from "@/lib/vpic";

export default function AddVehiclePage() {
const router = useRouter();
const { addCatalogVehicle, addCustomVehicle } = useGarage();
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

  // --- Manual entry: dropdown pickers (2026-09-18). Andy asked for dropdowns
  // for people who do not have a VIN handy. Year/Make/Model come from the free
  // NHTSA vPIC browse endpoints (src/lib/vpicBrowse.ts). Trim and Engine are
  // real dropdowns when our own catalog covers that year/make/model, and fall
  // back to free text otherwise, because vPIC only returns trim and engine
  // from an actual VIN decode and has no browseable list of either.
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [trim, setTrim] = useState("");
  const [engine, setEngine] = useState("");
  const [startMileage, setStartMileage] = useState("");
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [savingCustom, setSavingCustom] = useState(false);

  const years = useMemo(() => {
    const newest = new Date().getFullYear() + 1;
    return Array.from({ length: newest - 1995 }, (_, i) => String(newest - i));
  }, []);

  useEffect(() => {
    let cancelled = false;
    getVehicleMakes().then((list) => {
      if (!cancelled) setMakes(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!year || !make) {
      setModels([]);
      return;
    }
    let cancelled = false;
    setLoadingModels(true);
    setModels([]);
    getVehicleModels(make, year)
      .then((list) => {
        if (!cancelled) setModels(list);
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, make]);

  // The trim and engine choices we can offer with confidence come from our own
  // curated catalog, not from vPIC.
  const catalogMatches = useMemo(
    () => (year && make && model ? matchCatalogVehicles({ year, make, model }) : []),
    [year, make, model]
  );
  const trimOptions = useMemo(
    () => [...new Set(catalogMatches.map((v) => v.trim).filter(Boolean))] as string[],
    [catalogMatches]
  );
  const engineOptions = useMemo(
    () => [...new Set(catalogMatches.map((v) => v.engine).filter(Boolean))] as string[],
    [catalogMatches]
  );

  const fieldClass =
    "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none disabled:opacity-40";
  const labelClass = "mb-1 block text-xs text-slate-400";

  // Optional. Reminders read the odometer to sharpen their estimates, so
  // capturing it at add time means they are useful without a second visit.
  async function saveStartMileage(vehicleId: string) {
    const miles = Number(startMileage.replace(/[^0-9]/g, ""));
    if (!Number.isFinite(miles) || miles <= 0) return;
    await fetch(`/api/garage/${vehicleId}/odometer`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: miles }),
    }).catch(() => {});
  }

  async function handleAddCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!year || !make || !model) return;
    setSavingCustom(true);
    try {
      // If the picks land on a vehicle we actually have curated data for, send
      // them to the real page rather than a bare custom entry.
      const exact =
        catalogMatches.find((v) => v.engine === engine) ??
        (catalogMatches.length === 1 ? catalogMatches[0] : undefined);
      if (exact) {
        await addCatalogVehicle(exact.id);
        await saveStartMileage(exact.id);
        router.push(`/vehicles/${exact.id}`);
        return;
      }
      const id = await addCustomVehicle({
        year: year || undefined,
        make: make || undefined,
        model: model || undefined,
        trim: trim.trim() || undefined,
        engine: engine.trim() || undefined,
      });
      await saveStartMileage(id);
      router.push(`/garage/custom/${id}`);
    } finally {
      setSavingCustom(false);
    }
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

<section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
<h2 className="text-lg font-semibold text-slate-100">Don&apos;t have your VIN?</h2>
<p className="mt-1 text-sm text-slate-400">
Pick it from the lists below. If we have curated specs and guides for
it, we will take you straight to them. If not, you can still log
service history and get maintenance reminders.
</p>
<form onSubmit={handleAddCustom} className="mt-4 grid gap-3 sm:grid-cols-2">
  <div>
    <label htmlFor="year" className={labelClass}>
      Year
    </label>
    <select
      id="year"
      value={year}
      onChange={(e) => {
        setYear(e.target.value);
        setModel("");
        setTrim("");
        setEngine("");
      }}
      className={fieldClass}
    >
      <option value="">Select a year</option>
      {years.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  </div>
  <div>
    <label htmlFor="make" className={labelClass}>
      Make
    </label>
    <select
      id="make"
      value={make}
      onChange={(e) => {
        setMake(e.target.value);
        setModel("");
        setTrim("");
        setEngine("");
      }}
      disabled={!year}
      className={fieldClass}
    >
      <option value="">{makes.length ? "Select a make" : "Loading makes…"}</option>
      {makes.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
    </select>
  </div>
  <div>
    <label htmlFor="model" className={labelClass}>
      Model
    </label>
    <select
      id="model"
      value={model}
      onChange={(e) => {
        setModel(e.target.value);
        setTrim("");
        setEngine("");
      }}
      disabled={!year || !make || loadingModels}
      className={fieldClass}
    >
      <option value="">
        {loadingModels
          ? "Loading models…"
          : models.length
            ? "Select a model"
            : "Pick a year and make first"}
      </option>
      {models.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
    </select>
  </div>
  <div>
    <label htmlFor="trim" className={labelClass}>
      Trim{trimOptions.length === 0 ? " (optional)" : ""}
    </label>
    {trimOptions.length > 0 ? (
      <select
        id="trim"
        value={trim}
        onChange={(e) => setTrim(e.target.value)}
        className={fieldClass}
      >
        <option value="">Select a trim</option>
        {trimOptions.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    ) : (
      <input
        id="trim"
        value={trim}
        onChange={(e) => setTrim(e.target.value)}
        placeholder="LT, EX, XLT"
        className={fieldClass}
      />
    )}
  </div>
  <div>
    <label htmlFor="engine" className={labelClass}>
      Engine{engineOptions.length === 0 ? " (optional)" : ""}
    </label>
    {engineOptions.length > 0 ? (
      <select
        id="engine"
        value={engine}
        onChange={(e) => setEngine(e.target.value)}
        className={fieldClass}
      >
        <option value="">Select an engine</option>
        {engineOptions.map((en) => (
          <option key={en} value={en}>
            {en}
          </option>
        ))}
      </select>
    ) : (
      <input
        id="engine"
        value={engine}
        onChange={(e) => setEngine(e.target.value)}
        placeholder="3.6L V6"
        className={fieldClass}
      />
    )}
  </div>
  <div>
    <label htmlFor="startMileage" className={labelClass}>
      Current mileage (optional)
    </label>
    <input
      id="startMileage"
      value={startMileage}
      onChange={(e) => setStartMileage(e.target.value)}
      inputMode="numeric"
      placeholder="118500"
      className={fieldClass}
    />
  </div>
  {catalogMatches.length > 0 && (
    <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 sm:col-span-2">
      We have full specs, fluid capacities and guides for this one. Pick your
      engine and it will land on the curated page.
    </p>
  )}
  <p className="text-xs text-slate-500 sm:col-span-2">
    Mileage is optional and only sharpens your maintenance reminders. You can
    set or change it any time on the vehicle page.
  </p>
  <button
    type="submit"
    disabled={!year || !make || !model || savingCustom}
    className="rounded-lg bg-orange-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-50 sm:col-span-2"
  >
    {savingCustom ? "Adding…" : "+ Add to garage"}
  </button>
</form>
</section>
</div>
);
}
