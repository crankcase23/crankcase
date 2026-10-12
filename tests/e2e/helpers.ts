import { Page, expect } from "@playwright/test";

// Now that the garage lives behind real accounts (Auth.js credentials +
// Postgres, see src/auth.ts), every (app) route redirects to /login without
// a session. Each e2e test that touches the garage signs up its own
// throwaway account here so tests stay isolated from each other's data
// instead of sharing one seeded user.
// Every browser context in the suite gets its own network address (x-forwarded-for), the way real customers do. Without
// this all local traffic shares one address and the per-address VIN-attempt budget (src/lib/vinGuard.ts) would be spent
// by the suite itself. Pass an address to put several accounts behind the same one on purpose.
export const randomIp = () => `10.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${1 + Math.floor(Math.random() * 254)}`;

export async function signUpNewUser(page: Page, ip: string = randomIp()): Promise<string> {
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": ip });
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("testpassword123");
  await page.getByRole("button", { name: "Create Account" }).click();
  // Signup hashes the password with bcrypt cost 12 (and signs in, which verifies it again). On a busy CPU, such as several
  // Playwright workers sharing one box, that takes longer than the default 5 s assertion timeout, which made this flaky.
  await expect(page).toHaveURL(/\/garage$/, { timeout: 20_000 });
  return email;
}

// A well-formed, unique VIN (valid check digit) for tests. The server enforces the real VIN rules, so fixtures must be real-shaped.
const TRANSLIT: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9 };
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const ALPHA = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
export function checkDigit(v: string): string {
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += (/\d/.test(v[i]) ? Number(v[i]) : TRANSLIT[v[i]]) * WEIGHTS[i];
  const r = sum % 11;
  return r === 10 ? "X" : String(r);
}
export function validVin(prefix = "1HG"): string {
  // Six random characters (34^6 values) so VINs from parallel workers and from earlier runs never collide. The database
  // persists across runs and VINs are unique across accounts, so a weaker serial makes the suite flaky.
  let serial = "";
  for (let i = 0; i < 6; i++) serial += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  const body = prefix.toUpperCase().slice(0, 3).padEnd(3, "1") + "CM826" + "0" + "3A" + serial;
  const v = body.split("").map((c) => (ALPHA.includes(c) ? c : "1")).join("").slice(0, 17);
  return v.slice(0, 8) + checkDigit(v.slice(0, 8) + "0" + v.slice(9)) + v.slice(9);
}
