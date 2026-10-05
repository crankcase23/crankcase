// Garage Rewards ladder for "Get the Keys". LOCKED by Andy (Package 2 brief):
//   vehicle 1: $20, vehicle 2: $18, vehicle 3: $16, vehicle 4 and up: $15.
//   $15 floor. Unlock is permanent per vehicle; re-acquiring the same VIN
//   restores access.
//
// PRESENTATION ONLY. This is the published price ladder as a pure function so
// the screens can show it. It does not know what any user has unlocked, it
// enforces nothing, and it is not the server-side price calculation (that does
// not exist yet and must not be inferred from this file).

export const KEYS_LADDER: readonly number[] = [20, 18, 16, 15];

/** Price of the Nth vehicle a user unlocks (1-based). Floors at the last rung. */
export function keysPriceForNthVehicle(n: number): number {
  const i = Math.max(1, Math.floor(n)) - 1;
  return KEYS_LADDER[Math.min(i, KEYS_LADDER.length - 1)];
}

/**
 * VISUAL-ONLY STAND-IN. There is no unlock backend, so no user can have unlocked
 * any vehicle yet; the honest "next price" today is the first rung. When unlock
 * records exist this constant is replaced by the real count from the server,
 * not edited here.
 */
export const VISUAL_UNLOCKED_COUNT = 0;
