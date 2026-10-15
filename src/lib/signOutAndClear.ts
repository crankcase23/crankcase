"use client";

import { signOut } from "next-auth/react";
import { purgeAll, safeStorage } from "@/lib/wrenchProgress";

/**
 * The ONLY way UI code signs a customer out. It removes this device's saved Wrench progress first, then ends the session, so a
 * logout never leaves one account's job in browser storage for the next. A test (wrench-progress.test.mjs) fails if any other
 * file calls next-auth's signOut directly. Sessions that end without this button are covered by WrenchProgressGuard.
 */
export function signOutAndClear(options?: Parameters<typeof signOut>[0]) {
  purgeAll(safeStorage());
  return signOut(options);
}
