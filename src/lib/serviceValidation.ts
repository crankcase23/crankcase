// One definition of "a valid service-history entry", used by the form (so the customer is told before anything is sent)
// and by POST /api/garage/[id]/service (so nothing else can write junk). No imports: safe in the browser and on the server.
//
// Limits are deliberately roomy. The form joins every ticked job into one title, so TITLE_MAX has to fit a long run of
// guide names; MILEAGE_MAX is 7 digits to match the Wrench completion sheet.

export const SERVICE_LIMITS = {
  TITLE_MAX: 1500,
  NOTES_MAX: 2000,
  GUIDE_ID_MAX: 200,
  MILEAGE_MAX: 9_999_999,
} as const;

export type ServiceField = "date" | "mileage" | "title" | "notes" | "guideId";

export type ValidService = { date: string; mileage: number; title: string; guideId?: string; notes?: string };

export type ServiceValidation =
  | { ok: true; value: ValidService }
  | { ok: false; field: ServiceField | "body"; error: string };

const fail = (field: ServiceField | "body", error: string): ServiceValidation => ({ ok: false, field, error });

/** yyyy-mm-dd that is a real calendar day (rejects 2026-02-30 and 2026-13-01). */
export function isRealIsoDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** A whole-number mileage as a number, or a string of digits (what a form field holds). Anything else is not a mileage. */
function parseMileage(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isInteger(raw) ? raw : null;
  if (typeof raw === "string" && /^\d{1,7}$/.test(raw.trim())) return Number(raw.trim());
  return null;
}

export function validateServiceEntry(body: unknown): ServiceValidation {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return fail("body", "Send the entry as a JSON object.");
  const b = body as Record<string, unknown>;

  const date = typeof b.date === "string" ? b.date.trim() : "";
  if (!isRealIsoDate(date)) return fail("date", "Date must be a real calendar date, like 2026-01-15.");

  const mileage = parseMileage(b.mileage);
  if (mileage === null || mileage < 0 || mileage > SERVICE_LIMITS.MILEAGE_MAX) {
    return fail("mileage", `Mileage must be a whole number from 0 to ${SERVICE_LIMITS.MILEAGE_MAX.toLocaleString("en-US")}.`);
  }

  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title) return fail("title", "Pick or describe the service that was done.");
  if (title.length > SERVICE_LIMITS.TITLE_MAX) return fail("title", `Service description is too long (max ${SERVICE_LIMITS.TITLE_MAX} characters).`);

  let notes: string | undefined;
  if (b.notes !== undefined && b.notes !== null) {
    if (typeof b.notes !== "string") return fail("notes", "Notes must be text.");
    const n = b.notes.trim();
    if (n.length > SERVICE_LIMITS.NOTES_MAX) return fail("notes", `Notes are too long (max ${SERVICE_LIMITS.NOTES_MAX} characters).`);
    notes = n || undefined;
  }

  let guideId: string | undefined;
  if (b.guideId !== undefined && b.guideId !== null) {
    if (typeof b.guideId !== "string" || b.guideId.length > SERVICE_LIMITS.GUIDE_ID_MAX) return fail("guideId", "guideId must be a short string.");
    guideId = b.guideId || undefined;
  }

  return { ok: true, value: { date, mileage, title, guideId, notes } };
}
