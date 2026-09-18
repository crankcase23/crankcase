import Link from "next/link";
import type { ReactNode } from "react";
import { formatNumber, percentChange } from "@/lib/admin/format";

// ---------------------------------------------------------------------------
// Admin design system.
//
// Built entirely from the tokens the rest of Crankcase Garage already uses --
// slate-950/900/800 surfaces, orange-500 accent, Big Shoulders Display for
// display type via --font-display (src/app/globals.css). No new dependency,
// no second theme.
//
// The look: instrument panel. Thin rules, uppercase mono micro-labels,
// tabular figures so columns of numbers line up, a single hairline of accent
// at the top of each panel. Motion is limited to hover/focus feedback and one
// slow pulse on the live indicator -- nothing decorative.
// ---------------------------------------------------------------------------

export type Tone = "default" | "accent" | "positive" | "warning" | "critical" | "muted";

const TONE_TEXT: Record<Tone, string> = {
  default: "text-slate-100",
  accent: "text-orange-400",
  positive: "text-emerald-400",
  warning: "text-amber-400",
  critical: "text-rose-400",
  muted: "text-slate-500",
};

const TONE_CHIP: Record<Tone, string> = {
  default: "border-slate-700 bg-slate-800/60 text-slate-300",
  accent: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  positive: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  critical: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  muted: "border-slate-800 bg-slate-900/60 text-slate-500",
};

/** Small uppercase label used above values and as table/section eyebrows. */
export function MicroLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500 ${className}`}>
      {children}
    </span>
  );
}

export function Badge({ tone = "default", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${TONE_CHIP[tone]}`}
    >
      {children}
    </span>
  );
}

export type HealthState = "online" | "warning" | "error" | "offline" | "unknown";

const STATE_STYLE: Record<HealthState, { dot: string; text: string; label: string }> = {
  online: { dot: "bg-emerald-400", text: "text-emerald-400", label: "ONLINE" },
  warning: { dot: "bg-amber-400", text: "text-amber-400", label: "WARNING" },
  error: { dot: "bg-rose-500", text: "text-rose-400", label: "ERROR" },
  offline: { dot: "bg-slate-600", text: "text-slate-500", label: "OFFLINE" },
  unknown: { dot: "bg-slate-600", text: "text-slate-500", label: "UNKNOWN" },
};

export function StatusDot({ state, pulse = false }: { state: HealthState; pulse?: boolean }) {
  const s = STATE_STYLE[state];
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      {pulse && state === "online" && (
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${s.dot} opacity-60`} />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${s.dot}`} />
    </span>
  );
}

export function StatusPill({ state, label }: { state: HealthState; label?: string }) {
  const s = STATE_STYLE[state];
  return (
    <span className="inline-flex items-center gap-2">
      <StatusDot state={state} pulse={state === "online"} />
      <span className={`font-mono text-[11px] tracking-[0.14em] ${s.text}`}>{label ?? s.label}</span>
    </span>
  );
}

/**
 * The base surface. Every block of content in the admin sits in one of these.
 * The accent hairline across the top is what makes a wall of panels read as
 * an instrument cluster instead of a stack of cards.
 */
export function Panel({
  title,
  eyebrow,
  subtitle,
  action,
  children,
  padded = true,
  accent = false,
  className = "",
}: {
  title?: ReactNode;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  padded?: boolean;
  accent?: boolean;
  className?: string;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 ${className}`}
    >
      {accent && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/60 to-transparent" />
      )}
      {(title || action || eyebrow) && (
        <header className="flex items-start justify-between gap-4 border-b border-slate-800/80 px-4 py-3">
          <div className="min-w-0">
            {eyebrow && <div className="mb-1">{typeof eyebrow === "string" ? <MicroLabel>{eyebrow}</MicroLabel> : eyebrow}</div>}
            {title && (
              <h2
                className="truncate text-base font-semibold tracking-wide text-slate-100"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "0.02em" }}
              >
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={padded ? "p-4" : ""}>{children}</div>
    </section>
  );
}

/**
 * KPI tile. `value` of null means "we have no data source for this yet" and
 * renders the honest empty state rather than a zero that looks like a real
 * measurement.
 */
export function KpiCard({
  label,
  value,
  previous,
  unit,
  hint,
  tone = "default",
  href,
  awaiting = false,
}: {
  label: string;
  value: number | string | null;
  previous?: number | null;
  unit?: string;
  hint?: string;
  tone?: Tone;
  href?: string;
  awaiting?: boolean;
}) {
  const numeric = typeof value === "number" ? value : null;
  const change =
    numeric !== null && previous !== null && previous !== undefined ? percentChange(numeric, previous) : null;

  const body = (
    <div className="group relative h-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition-colors hover:border-slate-700">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-700/70 to-transparent group-hover:via-orange-500/50" />
      <MicroLabel>{label}</MicroLabel>

      {awaiting ? (
        <div className="mt-2">
          <div className="text-lg font-medium text-slate-600">Waiting for data</div>
          {hint && <p className="mt-1 text-[11px] leading-snug text-slate-600">{hint}</p>}
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span
              className={`text-3xl font-semibold tabular-nums ${TONE_TEXT[tone]}`}
              style={{ fontFamily: "var(--font-display)" }}
            >
              {typeof value === "number" ? formatNumber(value) : value ?? "--"}
            </span>
            {unit && <span className="text-xs text-slate-500">{unit}</span>}
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            {change !== null && (
              <span
                className={`font-mono text-[11px] tabular-nums ${
                  change > 0 ? "text-emerald-400" : change < 0 ? "text-rose-400" : "text-slate-500"
                }`}
              >
                {change > 0 ? "▲" : change < 0 ? "▼" : "■"} {Math.abs(change).toFixed(change === 0 ? 0 : 1)}%
              </span>
            )}
            {hint && <span className="truncate text-[11px] text-slate-600">{hint}</span>}
          </div>
        </>
      )}
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full focus:outline-none focus-visible:ring-1 focus-visible:ring-orange-500/60 rounded-xl">
      {body}
    </Link>
  ) : (
    body
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-800 px-6 py-10 text-center">
      <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-600">{title}</div>
      {message && <p className="max-w-md text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/**
 * Table shell. Horizontally scrollable on small screens rather than breaking
 * the layout; pages that need a truly different mobile shape render a card
 * list instead and hide the table below `sm`.
 */
export function Table({ children, minWidth = 720 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <div className="inline-block min-w-full align-middle">
        <table className="min-w-full text-sm" style={{ minWidth }}>
          {children}
        </table>
      </div>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-slate-800 bg-slate-900/60">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-800/70">{children}</tbody>;
}

export function TR({ children, href }: { children: ReactNode; href?: string }) {
  return (
    <tr className={`transition-colors hover:bg-slate-800/30 ${href ? "cursor-pointer" : ""}`}>{children}</tr>
  );
}

export function TH({
  children,
  align = "left",
  sortHref,
  active,
  direction,
}: {
  children: ReactNode;
  align?: "left" | "right" | "center";
  sortHref?: string;
  active?: boolean;
  direction?: "asc" | "desc";
}) {
  const alignment = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const inner = (
    <span className={`font-mono text-[10px] uppercase tracking-[0.16em] ${active ? "text-orange-400" : "text-slate-500"}`}>
      {children}
      {active && <span className="ml-1">{direction === "asc" ? "▲" : "▼"}</span>}
    </span>
  );
  return (
    <th scope="col" className={`whitespace-nowrap px-3 py-2.5 font-normal ${alignment}`}>
      {sortHref ? (
        <Link href={sortHref} className="hover:text-orange-300">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </th>
  );
}

export function TD({
  children,
  align = "left",
  muted = false,
  mono = false,
  className = "",
}: {
  children: ReactNode;
  align?: "left" | "right" | "center";
  muted?: boolean;
  mono?: boolean;
  className?: string;
}) {
  const alignment = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <td
      className={`px-3 py-2.5 align-middle ${alignment} ${muted ? "text-slate-500" : "text-slate-200"} ${
        mono ? "font-mono text-xs tabular-nums" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}

export function Pagination({
  page,
  pageCount,
  total,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) {
    return (
      <div className="flex items-center justify-end px-4 py-3">
        <MicroLabel>{formatNumber(total)} total</MicroLabel>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 px-4 py-3">
      <MicroLabel>
        Page {page} of {pageCount} · {formatNumber(total)} total
      </MicroLabel>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={hrefFor(page - 1)}
            className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:border-orange-500/50 hover:text-orange-300"
          >
            ← Prev
          </Link>
        ) : (
          <span className="rounded-md border border-slate-900 px-2.5 py-1 text-xs text-slate-700">← Prev</span>
        )}
        {page < pageCount ? (
          <Link
            href={hrefFor(page + 1)}
            className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:border-orange-500/50 hover:text-orange-300"
          >
            Next →
          </Link>
        ) : (
          <span className="rounded-md border border-slate-900 px-2.5 py-1 text-xs text-slate-700">Next →</span>
        )}
      </div>
    </div>
  );
}

/** Page title block used at the top of every admin section. */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1
          className="text-2xl font-bold tracking-wide text-slate-50 sm:text-3xl"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "0.03em" }}
        >
          {title}
        </h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Key/value rows used on detail pages. */
export function FieldList({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-slate-800/70">
      {rows.map((r) => (
        <div key={r.label} className="flex items-start justify-between gap-4 py-2.5 text-sm">
          <dt className="shrink-0 text-slate-500">{r.label}</dt>
          <dd className="text-right text-slate-200">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AdminButton({
  children,
  variant = "secondary",
  type = "submit",
  href,
  name,
  value,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  type?: "submit" | "button";
  href?: string;
  name?: string;
  value?: string;
}) {
  const styles = {
    primary: "border-orange-500 bg-orange-500 text-slate-950 hover:bg-orange-400",
    secondary: "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 hover:text-white",
    danger: "border-rose-500/50 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20",
  }[variant];

  const className = `inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${styles}`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} name={name} value={value} className={className}>
      {children}
    </button>
  );
}
