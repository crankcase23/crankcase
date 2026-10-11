import { Page, expect } from "@playwright/test";

// Now that the garage lives behind real accounts (Auth.js credentials +
// Postgres, see src/auth.ts), every (app) route redirects to /login without
// a session. Each e2e test that touches the garage signs up its own
// throwaway account here so tests stay isolated from each other's data
// instead of sharing one seeded user.
export async function signUpNewUser(page: Page): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("testpassword123");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/\/garage$/);
  return email;
}

// A unique, synthetic, well-formed VIN for tests (WMI "WVW" is non-North-American, so only the format is checked, never a
// check digit; no real vehicle has this VIN). Every garage add now requires a VIN.
const VIN_ALPHABET = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
export function testVin(): string {
  let s = "WVWZZZ";
  for (let i = 0; i < 11; i++) s += VIN_ALPHABET[Math.floor(Math.random() * VIN_ALPHABET.length)];
  return s;
}
