// Garage Rewards ladder for "Get the Keys". LOCKED by Andy (Package 2 brief):
//   vehicle 1: $20, vehicle 2: $18, vehicle 3: $16, vehicle 4 and up: $15.
//   $15 floor. Unlock is permanent per vehicle; re-acquiring the same VIN
//   restores access.
//
// This file is the single source of the ladder. The pure functions below do not know what any user has unlocked.
// The SERVER price a customer is actually charged is computed in src/lib/keysEntitlements.ts (nextUnlockPrice), from the
// customer's own purchased entitlements, using keysPriceCentsForNthVehicle() below; the browser never supplies a price.

export const KEYS_LADDER: readonly number[] = [20, 18, 16, 15];

/** Price of the Nth vehicle a user unlocks (1-based). Floors at the last rung. */
export function keysPriceForNthVehicle(n: number): number {
  const i = Math.max(1, Math.floor(n)) - 1;
  return KEYS_LADDER[Math.min(i, KEYS_LADDER.length - 1)];
}

/** Same ladder in cents, for server pricing and the purchase record. */
export function keysPriceCentsForNthVehicle(n: number): number {
  return keysPriceForNthVehicle(n) * 100;
}

/**
 * VISUAL-ONLY STAND-IN. There is no unlock backend, so no user can have unlocked
 * any vehicle yet; the honest "next price" today is the first rung. When unlock
 * records exist this constant is replaced by the real count from the server,
 * not edited here.
 */
export const VISUAL_UNLOCKED_COUNT = 0;
