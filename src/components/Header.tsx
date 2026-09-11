"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import CrankcaseMark from "@/components/CrankcaseMark";

export default function Header() {
  return (
    <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
        <Link href="/garage" className="flex items-center gap-2 text-slate-100 font-bold text-lg">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-orange-500 p-1.5">
            <CrankcaseMark panFill="#0f172a" accentFill="#f97316" />
          </span>
          Crank<span className="text-orange-500">case</span>
        </Link>
        <nav className="flex items-center gap-5 text-sm text-slate-300">
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
      </div>
    </header>
  );
}
