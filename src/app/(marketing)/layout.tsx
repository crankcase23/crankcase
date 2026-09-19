import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import CrankcaseBadge from "@/components/CrankcaseBadge";
import SiteHeader from "@/components/SiteHeader";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // Only a query for signed-in visitors -- logged-out marketing pages, which are
  // the ones that have to be fast, skip it entirely.
  let isAdmin = false;
  if (session?.user?.id) {
    const rows = await db.select().from(users).where(eq(users.id, session.user.id));
    isAdmin = rows[0]?.isAdmin ?? false;
  }

  return (
    <>
      <SiteHeader isAuthed={!!session} isAdmin={isAdmin} />

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-10 sm:grid-cols-4">
            <div className="sm:col-span-1">
              <CrankcaseBadge className="h-9 w-auto" />
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
                  <Link href="/how-it-works" className="hover:text-white">
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
                <li>
                  <Link href="/decode" className="hover:text-white">
                    VIN Lookup
                  </Link>
                </li>
                <li>
                  <Link href="/swag" className="hover:text-white">
                    Swag
                  </Link>
                </li>
                <li>
                  <Link href="/cart" className="hover:text-white">
                    Cart
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Account
              </div>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                {session ? (
                  <li>
                    <Link href="/garage" className="hover:text-white">
                      My Garage
                    </Link>
                  </li>
                ) : (
                  <>
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
                  </>
                )}
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
