// Marks a vehicle whose details the customer typed by hand while the NHTSA decoder was down. Crankcase has not checked
// them against NHTSA yet (src/lib/vinFallback.ts), so the label must stay visible wherever the vehicle is shown.
export default function UnverifiedBadge({ className = "" }: { className?: string }) {
  return (
    <span
      data-testid="unverified-badge"
      title="You typed these details yourself; they haven't been checked against NHTSA yet."
      className={`inline-block rounded border border-amber-400/60 bg-amber-400/10 px-1.5 py-0.5 align-middle text-[0.65rem] font-bold uppercase tracking-wider text-amber-300 ${className}`}
    >
      Unverified
    </span>
  );
}
