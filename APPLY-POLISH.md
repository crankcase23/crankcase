# Five small fixes — how to apply

No database changes this time. Code only, one commit, 9 files.

Open a terminal in `C:\Users\antho\Documents\Crankcase` (Win+R → `cmd`, then
`cd /d C:\Users\antho\Documents\Crankcase`).

---

## Step 1 — sync

```
git fetch origin
git reset --hard origin/main
```

This just catches you up. There's nothing local to lose — you pushed everything.

## Step 2 — apply and push

```
git am admin-polish.patch
git push
```

## Step 3 — confirm Vercel built it

Check your Deployments list and make sure a build exists for the new commit.
Same as last time — this project has a habit of occasionally not triggering one.

---

## What changed

**1. Logo overlap.** The wordmark had no width constraint, so its layout
depended on Big Shoulders Display actually loading. When that font is slow or
blocked, the much wider fallback ran straight into the GARAGE chip. Both text
elements are now pinned with `textLength`, and `--font-display` picked up
condensed fallbacks so a substitute needs less squeezing.

Verified with the font blocked completely: CRANKCASE ends at x=252, the chip
starts at x=262. It cannot overlap regardless of what font renders.

**2. Delete confirmation.** `/admin/users` ignored the `?ok=` message the
account-delete handler redirects back with, so deleting an account looked like
nothing happened. Now it shows the banner.

**3. Tracking gap.** Custom vehicles had no view tracking — which meant the
vehicles in your demand backlog were the only ones not being counted. Fixed.

**4. Lint.** Removed a redundant `setState` inside an effect and an unused
variable. Also documented, inline, why `layout.tsx` loads its font with a plain
`<link>` instead of `next/font/google`: that switch **fails the build** for this
font, and the lint warning was actively inviting someone to "fix" it and break
the deploy. That comment is probably the most valuable line in this patch.

**5. Dead files.** Deleted `Header-1.tsx`, `PrintServiceHistory-1.tsx`,
`PrintVehicleSpecSheet-1.tsx` — stray duplicates, imported nowhere.

---

## What I did NOT fix, and why

One lint error remains, in `AddVehicleClient.tsx` — a `setState` called
synchronously inside an effect. It's in the Add-a-Vehicle work that shipped
while we were building the admin.

Clearing it properly means restructuring how that component derives its model
list. That's a real refactor of a feature that went live hours ago, I can't test
it against the live vPIC API from here, and the payoff is a lint warning — the
build passes and the feature works. Not worth the regression risk unattended.

Worth doing deliberately sometime, with the Add-a-Vehicle flow open in front of
you to click through afterward.

---

## Verification

- `next build` clean, exit 0
- `tsc --noEmit` clean
- Lint down from 4 problems to 1 (the one above)
- Booted the production build against a real seeded Postgres and hit all 9
  admin sections plus 6 user-facing pages — all 200, zero runtime errors
- Logo geometry measured in a browser with Google Fonts blocked
- Patch verified with `git apply --check` against a pristine checkout of
  `b045214`
