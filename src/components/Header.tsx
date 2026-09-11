"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import CrankcaseMark from "@/components/CrankcaseMark";

export default function Header() {
  const [open, setOpen] = useState(false);

return (
  <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur sticky top-0 z-10">
  <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
  <Link
    href="/garage"
    className="flex items-center gap-2 text-slate-100 font-bold text-lg"
    onClick={() => setOpen(false)}
    >
  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-orange-500 p-1.5">
  <CrankcaseMark panFill="#0f172a" accentFill="#f97316" />
  </span>
  Crank<span className="text-orange-500">case</span>
  </Link>
  
  <nav className="hidden sm:flex items-center gap-5 text-sm text-slate-300">
  <Link href="/garage" className="hover:text-white">
  My Garage
  </Link>
  <Link href="/decode" className="hover:text-white">
  VIN Lookup
  </Link>
  <button
    type="button"
    onClick={() => signOut({ callbackUrl: "/" })}
    className="text-slate-500 hover:text-white"
    >
  Log out
  </button>
  </nav>
  
  <button
    type="button"
    onClick={() => setOpen((v) => !v)}
    aria-label={open ? "Close menu" : "Open menu"}
    aria-expanded={open}
    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white sm:hidden"
    >
    {open ? (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
      </svg>
      ) : (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
      </svg>
  )}
  </button>
  </div>
  
    {open && (
    <nav className="border-t border-slate-800 px-4 py-3 flex flex-col gap-3 text-sm text-slate-300 sm:hidden">
    <Link href="/garage" className="hover:text-white" onClick={() => setOpen(false)}>
    My Garage
    </Link>
    <Link href="/decode" className="hover:text-white" onClick={() => setOpen(false)}>
    VIN Lookup
    </Link>
    <button
      type="button"
      onClick={() => {
        setOpen(false);
        signOut({ callbackUrl: "/" });
      }}
      className="text-left text-slate-500 hover:text-white"
      >
    Log out
    </button>
    </nav>
  )}
  </header>
  );
}
