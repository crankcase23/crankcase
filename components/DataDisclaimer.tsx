export default function DataDisclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`rounded-lg border border-amber-300 bg-amber-50 text-amber-900 ${
        compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"
      }`}
    >
      <span className="font-semibold">Reference figures, not gospel.</span>{" "}
      Capacities, torque values, and steps here are general starting points and
      can vary by trim, options, and model-year running changes. Always confirm
      against your vehicle&apos;s factory service manual or door-jamb/build sticker
      before you finalize a fluid fill or torque a fastener. Crankcase covers
      routine maintenance — oil changes, brakes, fluids, filters, and the like —
      not engine, transmission, or other major repair work; for anything beyond
      that, see a professional mechanic.
    </div>
  );
}
