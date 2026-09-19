"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setError(null);
  if (password !== confirmPassword) {
    setError("Passwords don't match.");
    return;
  }
  setSubmitting(true);
  const res = await fetch("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  setSubmitting(false);
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    setError(data?.error || "Something went wrong. Try again.");
    return;
  }
  setDone(true);
}

if (!token) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
    <h1 className="text-2xl font-bold text-slate-50">Invalid reset link</h1>
    <p className="mt-1 text-sm text-slate-400">
    This password reset link is missing its token. Request a new one from the{" "}
    <Link href="/forgot-password" className="font-medium text-orange-400 hover:text-orange-300">
    forgot password
    </Link>{" "}
    page.
    </p>
    </div>
    );
}
  
  if (done) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-bold text-slate-50">Password updated</h1>
      <p className="mt-1 text-sm text-slate-400">
      Your password has been reset. You can now log in with your new password.
      </p>
      <Link
        href="/login"
        className="mt-8 block w-full rounded-lg bg-orange-500 px-4 py-2.5 text-center font-semibold text-slate-950 hover:bg-orange-400"
        >
      Go to log in
      </Link>
      </div>
      );
  }
  
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
    <h1 className="text-2xl font-bold text-slate-50">Set a new password</h1>
    <p className="mt-1 text-sm text-slate-400">
    Choose a new password for your account.
    </p>
    
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      {error ? (
      <div className="rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-300">
        {error}
      </div>
      ) : null}
    <div>
    <label htmlFor="password" className="mb-1 block text-xs text-slate-400">
    New password
    </label>
    <div className="relative">
    <input
      id="password"
      type={showPassword ? "text" : "password"}
      placeholder="••••••••"
      required
      minLength={8}
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 pr-16 text-sm text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
      />
    <button
      type="button"
      onClick={() => setShowPassword((v) => !v)}
      className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-slate-400 hover:text-slate-200"
      >
      {showPassword ? "Hide" : "Show"}
    </button>
    </div>
    </div>
    <div>
    <label htmlFor="confirmPassword" className="mb-1 block text-xs text-slate-400">
    Confirm new password
    </label>
    <input
      id="confirmPassword"
      type={showPassword ? "text" : "password"}
      placeholder="••••••••"
      required
      minLength={8}
      value={confirmPassword}
      onChange={(e) => setConfirmPassword(e.target.value)}
      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
      />
    </div>
    <button
      type="submit"
      disabled={submitting}
      className="w-full rounded-lg bg-orange-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-60"
      >
      {submitting ? "Saving…" : "Set new password"}
    </button>
    </form>
    </div>
    );
}
