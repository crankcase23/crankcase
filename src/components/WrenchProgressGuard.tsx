"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { purgeAll, purgeForeign, safeStorage } from "@/lib/wrenchProgress";

/**
 * Keeps device-local Wrench progress from outliving or crossing accounts. Rendered by every layout, with the signed-in
 * account's scope (or null when nobody is signed in):
 *   signed in  -> remove every record that belongs to a different account
 *   signed out -> remove every record
 * So whatever ended the previous session (Log out, expiry, cleared cookies, signing in from another tab or device), the next
 * page this browser loads cleans up before the next account can reach it. The Log out buttons clear on the spot too
 * (signOutAndClear). Renders nothing.
 */
export default function WrenchProgressGuard({ scope }: { scope: string | null }) {
  const pathname = usePathname();
  useEffect(() => {
    const storage = safeStorage();
    if (scope) purgeForeign(storage, scope);
    else purgeAll(storage);
  }, [scope, pathname]);
  return null;
}
