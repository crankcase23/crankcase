"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setSubmitting(true);
  await fetch("/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  setSubmitting(false);
  setSubmitted(true);
}

return (
  <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
  <h1 className="text-2xl font-bold text-slate-50">Reset your password</h1>
  <p className="mt-1 text-sm text-slate-400">
  Enter the email on your account and we&apos;ll send you a link to set a new password.
  </p>
  
    {submitted ? (
    <div className="mt-8 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300">
    If an account exists for that email, a reset link is on its way. Check your inbox.
    </div>
    ) : (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
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
