"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// "Report a problem" -- the user-facing half of the admin To-Do inbox.
//
// Why this exists: on a site whose whole value is torque specs and fluid
// capacities, the most important thing a user can tell you is "this number
// looks wrong." Nothing else in the app captures that. A wrong torque value
// doesn't throw an error, doesn't show up in analytics, and doesn't hurt any
// metric -- it just quietly makes someone strip a bolt.
//
// Design constraints, deliberately:
//   * Collapsed to a single unobtrusive link until clicked. This sits at the
//     bottom of guide pages; it must not compete with the content.
//   * Page context (path, vehicle, guide) is attached automatically, so the
//     report is actionable without a back-and-forth.
//   * No email field. They're signed in -- the account is already the contact.
//   * Fails quietly and says so honestly. A broken feedback form must never
//     eat what someone took the trouble to type.
// ---------------------------------------------------------------------------

const KINDS = [
  { value: "data", label: "A spec or number looks wrong" },
  { value: "bug", label: "Something on the page is broken" },
  { value: "idea", label: "Suggestion" },
  { value: "other", label: "Something else" },
] as const;

export default function FeedbackWidget({
  vehicleId,
  guideId,
}: {
  vehicleId?: string;
  guideId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>("data");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (text.length < 5) return;

    setState("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          message: text,
          vehicleId,
          guideId,
          path: typeof window !== "undefined" ? window.location.pathname : undefined,
        }),
      });
      if (!res.ok) throw new Error("bad status");
      setState("sent");
      setMessage("");
    } catch {
      setState("error");
    }
  }

  if (!open) {
    return (
      <div className="mt-10 border-t border-slate-800 pt-5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm text-slate-500 underline-offset-4 hover:text-orange-400 hover:underline"
        >
          Spot something wrong on this page? Tell us
        </button>
      </div>
    );
  }

  return (
    <div className="mt-10 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      {state === "sent" ? (
        <div>
          <p className="text-sm font-medium text-emerald-400">Thanks — that went straight through.</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            A real person reads these. If you flagged a spec, we check it against the source before changing
            anything.
          </p>
          <button
            type="button"
            onClick={() => {
              setState("idle");
              setOpen(false);
            }}
            className="mt-3 text-xs text-slate-500 hover:text-slate-300"
          >
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Report a problem</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                We&apos;ll automatically include which page you&apos;re on.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="shrink-0 text-slate-600 hover:text-slate-300"
            >
              ✕
            </button>
          </div>

          <fieldset className="mb-3">
            <legend className="sr-only">What kind of problem?</legend>
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setKind(k.value)}
                  aria-pressed={kind === k.value}
                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                    kind === k.value
                      ? "border-orange-500 bg-orange-500/10 text-orange-300"
                      : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label htmlFor="feedback-message" className="sr-only">
            What&apos;s wrong?
          </label>
          <textarea
            id="feedback-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={2000}
            required
            placeholder={
              kind === "data"
                ? "Which value, and what do you think it should be? If you have a source, even better."
                : "What happened?"
            }
            className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-orange-500/50 focus:outline-none"
          />

          <div className="mt-3 flex items-center gap-3">
            <button
              type="submit"
              disabled={state === "sending" || message.trim().length < 5}
              className="rounded-md border border-orange-500 bg-orange-500 px-3 py-1.5 text-xs font-medium text-slate-950 transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {state === "sending" ? "Sending…" : "Send"}
            </button>
            {state === "error" && (
              <span className="text-xs text-rose-400">
                That didn&apos;t send. Your message is still here — try again in a moment.
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
