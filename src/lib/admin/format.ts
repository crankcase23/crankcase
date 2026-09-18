// Shared formatting for the admin UI. Kept in one place so every number,
// date and money value in the command center reads the same way.

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "--";
  return n.toLocaleString("en-US");
}

// Cents -> "$1,234.56". Whole-dollar amounts drop the cents for density.
export function formatCurrency(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return "--";
  const dollars = cents / 100;
  const fractionDigits = Number.isInteger(dollars) ? 0 : 2;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${value.toFixed(digits)}%`;
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "--";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "--";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// "3m ago", "2h ago", "5d ago" -- the activity feed reads better relative.
export function relativeTime(d: Date | string | null | undefined): string {
  if (!d) return "--";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "--";

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// Accounts have no name until an admin sets one -- fall back to the email's
// local part rather than showing an empty cell.
export function displayName(name: string | null | undefined, email: string): string {
  if (name && name.trim()) return name.trim();
  return email.split("@")[0] ?? email;
}

export function initialsFor(name: string | null | undefined, email: string): string {
  const source = displayName(name, email);
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

// Percent change between two periods, or null when there's no baseline to
// compare against (so the UI can say "no prior data" instead of "+100%").
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}
