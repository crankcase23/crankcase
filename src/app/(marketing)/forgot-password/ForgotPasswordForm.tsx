"use client";

import Link from "next/link";
import { useState } from "react";

// What this page may and may not say (build 104-E):
//   * "success" is shown ONLY when the server answered 2xx. A 500, a 429 or a dropped connection is an error the customer can act on.
//   * Even on success the wording is generic and promises nothing about delivery: the server answers identically whether or not an
//     account exists (so this page cannot say "we sent it"), and the mail itself can still fail or land in spam.
//   * The loading state always ends (finally), the typed address is kept, and the same form can be submitted again.
type Status = "idle" | "submitting" | "sent" | "error";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus("sent");
        return;
      }
      setError(
        res.status === 429
          ? "Too many reset requests. Please wait a few minutes and try again."
          : "We couldn't send that request. Please try again in a minute.",
      );
    } catch {
      setError("We couldn't reach Crankcase Garage. Check your connection and try again.");
    }
    setStatus("error");
  }

  const submitting = status === "submitting";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-bold text-slate-50">Reset your password</h1>
      <p className="mt-1 text-sm text-slate-400">
        Enter the email on your account and we&apos;ll send you a link to set a new password.
      </p>

      {status === "sent" ? (
        <div className="mt-8 space-y-3 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300">
          <p>
            If an account exists for that email, we&apos;ll email it a reset link. It can take a few minutes and may land
            in your spam folder.
          </p>
          <p className="text-slate-400">
            Nothing after a few minutes?{" "}
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="font-medium text-orange-400 hover:text-orange-300"
            >
              Try a different email
            </button>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {error ? (
            <div role="alert" className="rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          ) : null}
          <div>
            <label htmlFor="email" className="mb-1 block text-xs text-slate-400">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-orange-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-slate-400">
        <Link href="/login" className="font-medium text-orange-400 hover:text-orange-300">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
