# Crankcase Command Center — how to ship it

Two steps, in this order. **Run the database migration before you deploy the
code**, or every page that touches `users` will 500 — the app selects columns
that won't exist yet.

---

## Step 1 — Database (Neon, ~3 minutes)

Open `admin-command-center-migration.sql`. Go to Vercel → Storage → your Neon
database → **Query**.

**Run one numbered statement at a time.** Neon's panel executes each submission
as a single prepared statement, so pasting several semicolon-separated
statements at once fails with *"cannot insert multiple commands into a prepared
statement"*. (This is the same gotcha from every previous migration on this
project.)

Every statement is `IF NOT EXISTS`, so re-running one that's already applied is
harmless.

Statements 1 and 2 re-apply the **login-history migration from 2026-09-16**,
which my notes say was never confirmed as run. If it wasn't, parts of your
current admin page have been erroring — these fix that.

Statement 26 grants your account `super_admin`. It matches on
`andym@redlineorigin.com` — change the email in that statement if your admin
account uses a different one. **Skip it and you'll be treated as a Support
Admin**, which can't delete accounts, manage roles or publish content.

All 27 statements were executed individually against a real Postgres 16
instance here — zero failures.

---

## Step 2 — Code

Your local copy at `C:\Users\antho\Documents\Crankcase` is about a week behind
`origin/main` — it's missing the entire `/admin` section, the account page, the
password-reset flow and the Open Labor Project work. **Committing from it as-is
would revert all of that**, which is why this is a patch rather than loose
files.

Open a terminal in the repo folder and run:

```
cd C:\Users\antho\Documents\Crankcase

git fetch origin
git reset --hard origin/main
```

That discards the stale working tree and puts you on the real `main`. Nothing
of yours is lost — everything in that folder already exists on GitHub.

Then apply the patch and push:

```
git apply admin-command-center.patch
git add -A
git commit -m "Admin: build the Crankcase Command Center"
git push
```

If you'd rather have the commit message written for you, use this instead of
the three lines above:

```
git am admin-command-center.patch
git push
```

The patch was built directly on `origin/main` (`24c6ef0`) and verified with
`git apply --check` against a pristine checkout of that commit — it applies
with zero conflicts and produces a tree byte-identical to the one I tested.

---

## Step 3 — Check it

Go to `https://www.crankcasegarage.com/admin`.

There's still no nav link pointing there, on purpose. Non-admins and
logged-out visitors get redirected to `/garage` rather than shown an "access
denied" page, so the section's existence stays hidden.

Worth eyeballing:

- The **Attention Required** panel on the right only appears when something is
  actually wrong. If it's missing, nothing needs you.
- **Revenue** will say "Waiting for data" everywhere. That's correct — there's
  no checkout. It is not broken.
- **Service Guides** should show 6 guides and flag any that fail the publish
  checklist.
- **Vehicles → Demand backlog** ranks the vehicles users added that you have no
  curated data for. That's your content roadmap, written by real demand.

---

## If something goes wrong

The migration is additive and idempotent — nothing is dropped or rewritten, so
there's no data-loss path in it. To back the code out:

```
git revert HEAD
git push
```

The new tables can stay; nothing else reads them.
