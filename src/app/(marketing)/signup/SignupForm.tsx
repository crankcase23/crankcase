"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // A failed request must end in a visible message and a usable form (build 104-F): a dropped connection or a non-JSON reply from a
  // proxy used to leave "Creating account…" up forever with an unhandled rejection. Messages the server sends are shown as they are.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    let res: Response;
    try {
      res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      setError("We couldn't reach Crankcase Garage. Check your connection and try again.");
      setSubmitting(false);
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(
        typeof data?.error === "string" && data.error
          ? data.error
          : res.status === 429
            ? "Too many sign-up attempts. Wait a bit and try again."
            : "We couldn't create your account right now. Please try again in a minute.",
      );
      setSubmitting(false);
      return;
    }

    let signedIn = false;
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      signedIn = !result?.error;
    } catch {
      signedIn = false;
    }
    setSubmitting(false);
    if (!signedIn) {
      // Account was created but auto-login failed — send them to log in manually.
      router.push("/login");
      return;
    }
    router.push("/garage");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-bold text-slate-50">Create your garage</h1>
      <p className="mt-1 text-sm text-slate-400">
        Free to start — specs, fluids, and one guide per vehicle, always. Syncs across
        every device you log into.
      </p>

      <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                🧰 Heads up — Crankcase Garage is built for routine maintenance (oil changes, brakes,
        fluids, filters). For engine, transmission, or other major repair work, please
        consult a professional mechanic.
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
        <div>
          <label htmlFor="password" className="mb-1 block text-xs text-slate-400">
            Password
          </label>
          <input
            id="password"
            type="password"
            placeholder="At least 8 characters"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-orange-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-60"
        >
          {submitting ? "Creating account…" : "Create Account"}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-800" />
        <span className="text-xs text-slate-600">or</span>
        <div className="h-px flex-1 bg-slate-800" />
      </div>

      <button
        type="button"
        disabled
        title="Coming soon"
        className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-500"
      >
        <span aria-hidden>G</span> Continue with Google
      </button>

      <p className="mt-6 text-center text-sm text-slate-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-orange-400 hover:text-orange-300">
          Log in
        </Link>
      </p>
    </div>
  );
}
