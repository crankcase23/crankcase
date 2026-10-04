export default function DataDisclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <p
      className={`border-l-2 border-amber-400/50 pl-3.5 leading-relaxed text-slate-400 ${
        compact ? "text-xs" : "text-[0.82rem]"
      }`}
    >
      <span className="font-semibold text-amber-300/90">Reference figures.</span>{" "}
      Capacities, torque values and steps are general starting points and can vary by trim, options and
      model year. Check your factory service information or door-jamb sticker before you fill a fluid or
      torque a fastener, and use your own judgment. Crankcase covers routine maintenance; for major repair
      work, see a professional mechanic.
    </p>
  );
}
