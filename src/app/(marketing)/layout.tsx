import Link from "next/link";
import CrankcaseMark from "@/components/CrankcaseMark";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-100 font-bold text-lg">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-orange-500 p-1.5">
              <CrankcaseMark panFill="#0f172a" accentFill="#f97316" className="h-5 w-5" />
            </span>
            Crank<span className="text-orange-500">case</span> Garage
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/#how-it-works" className="hidden text-slate-300 hover:text-white sm:inline">
              How It Works
            </Link>
            <Link href="/pricing" className="hidden text-slate-300 hover:text-white sm:inline">
              Pricing
            </Link>
            <Link href="/login" className="text-slate-300 hover:text-white">
              Log In
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-orange-500 px-4 py-2 font-semibold text-slate-950 hover:bg-orange-400"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-10 sm:grid-cols-4">
            <div className="sm:col-span-1">
              <div className="flex items-center gap-2 text-slate-100 font-bold">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-orange-500 p-1.5">
                  <CrankcaseMark panFill="#0f172a" accentFill="#f97316" className="h-4 w-4" />
                </span>
                Crank<span className="text-orange-500">case</span> Garage
              </div>
              <p className="mt-3 text-sm text-slate-500">
                Fluid capacities, torque specs, and step-by-step repair guides for the car
                you actually own.
              </p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Product
              </div>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                <li>
                  <Link href="/#how-it-works" className="hover:text-white">
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-white">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/vehicles/2014-jeep-grand-cherokee-3.6l" className="hover:text-white">
                    Live Demo
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Account
              </div>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                <li>
                  <Link href="/login" className="hover:text-white">
                    Log In
                  </Link>
                </li>
                <li>
                  <Link href="/signup" className="hover:text-white">
                    Sign Up
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Legal
              </div>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                <li>
                  <Link href="/terms" className="hover:text-white">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-white">
                    Privacy
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-slate-800 pt-6 text-xs text-slate-600">
            &copy; {new Date().getFullYear()} Crankcase Garage. Early prototype — not a live public
            product yet. Specs and torque values are general reference figures, not a
            replacement for your factory service manual.
          </div>
        </div>
      </footer>
    </>
  );
}
