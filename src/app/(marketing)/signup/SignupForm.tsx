"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);

  // Text typed (or autofilled) BEFORE this component hydrates is already in the DOM but never went through onChange, so state is still
  // empty while the field looks filled in. Adopt it once, at mount: otherwise the next re-render (an error message, say) would blank the
  // field, and a submit would post empty values (build 104-H, KD-1).
  useEffect(() => {
    if (emailInput.current?.value) setEmail(emailInput.current.value);
    if (passwordInput.current?.value) setPassword(passwordInput.current.value);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // What is on screen is what is submitted, whether or not React saw the keystrokes (autofill and pre-hydration typing skip onChange).
    const email = emailInput.current?.value ?? "";
    const password = passwordInput.current?.value ?? "";
    // Bring React's state in line with the screen, or the re-render below resets the fields to the stale (empty) state.
    setEmail(email);
    setPassword(password);
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Could not create your account.");
      setSubmitting(false);
      return;
    }

    const result = await signIn("credentials", { email, password, redirect: false });
    setSubmitting(false);
    if (result?.error) {
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
          <div className="rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        ) : null}
        <div>
          <label htmlFor="email" className="mb-1 block text-xs text-slate-400">
            Email
          </label>
          <input
            id="email"
            ref={emailInput}
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
            ref={passwordInput}
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
