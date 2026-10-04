// One-line "what needs attention" summary for a vehicle card on My Garage.
//
// Pure function over the output of computeReminders() -- no new product rules,
// no new data. It only decides which of the reminders the app ALREADY computes
// is worth one line on a card, and how to word it. Everything it says comes from
// a reminder result; when there is nothing true to say it returns null and the
// card falls back to its own neutral line.

import type { ReminderResult } from "@/lib/reminders";

export type GarageStatusTone = "overdue" | "due-soon" | "ok";

export interface GarageStatus {
  tone: GarageStatusTone;
  text: string;
}

function roundMiles(n: number): string {
  // "about 400 mi" -- never imply more precision than a rule-of-thumb interval has.
  const r = n >= 100 ? Math.round(n / 50) * 50 : Math.max(50, Math.round(n / 10) * 10);
  return r.toLocaleString("en-US");
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function describe(r: ReminderResult): string {
  const label = r.item.label;
  if (r.status === "overdue") {
    if (r.dueMilesRemaining != null) return `${label} overdue by about ${roundMiles(Math.abs(r.dueMilesRemaining))} mi`;
    if (r.dueDate) return `${label} was due ${shortDate(r.dueDate)}`;
    return `${label} overdue`;
  }
  // due-soon
  if (r.dueMilesRemaining != null) return `${label} due in about ${roundMiles(r.dueMilesRemaining)} mi`;
  if (r.dueDate) return `${label} due ${shortDate(r.dueDate)}`;
  return `${label} due soon`;
}

/**
 * Most urgent thing first: overdue (furthest past due first), then due-soon
 * (closest first). If every reminder we could evaluate is fine, say so -- but
 * only if at least one was actually evaluated against a logged service; a
 * vehicle with nothing logged gets null, never a false "all good".
 */
export function summarizeGarageStatus(results: ReminderResult[]): GarageStatus | null {
  const rank = (r: ReminderResult) => r.dueMilesRemaining ?? (r.dueDate ? (new Date(`${r.dueDate}T00:00:00`).getTime() - Date.now()) / 86_400_000 * 40 : 0);

  const overdue = results.filter((r) => r.status === "overdue").sort((a, b) => rank(a) - rank(b));
  if (overdue.length) return { tone: "overdue", text: describe(overdue[0]) };

  const soon = results.filter((r) => r.status === "due-soon").sort((a, b) => rank(a) - rank(b));
  if (soon.length) return { tone: "due-soon", text: describe(soon[0]) };

  if (results.some((r) => r.status === "ok")) return { tone: "ok", text: "Logged services are on schedule" };
  return null;
}
