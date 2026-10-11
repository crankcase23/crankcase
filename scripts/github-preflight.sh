#!/usr/bin/env bash
# GitHub preflight for feature-branch work. Never commits, pushes, or merges. It writes only generated files
# (.next, tsbuildinfo, next-env.d.ts which it restores) and updates the local origin/main ref via fetch.
#   bash scripts/github-preflight.sh check [--build]   run before committing/pushing
#   bash scripts/github-preflight.sh receipt            run after pushing; verifies remote SHA == local HEAD
# Rules live in CLAUDE.md ("GitHub workflow"). Non-zero exit = do not push. A check that cannot run is a FAIL, never a pass.
set -u
set -o pipefail
export LC_ALL=C
REPO="crankcase23/crankcase"
BASE="origin/main"
fail=0
say() { printf '%s\n' "$*"; }
bad() { say "FAIL: $*"; fail=1; }
ok()  { say "ok:   $*"; }
note(){ say "NOTE: $*"; }

cd "$(git rev-parse --show-toplevel)" || exit 2
gitdir=$(git rev-parse --git-dir)
branch=$(git rev-parse --abbrev-ref HEAD)
url=$(git remote get-url origin 2>/dev/null || true)
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

# 1. repository and branch (anchored match; never echo a URL that may carry a token)
if printf '%s' "$url" | grep -Eq "^(https://([^/@]+@)?github\.com/|git@github\.com:)$REPO(\.git)?/?$"; then ok "origin is $REPO"; else bad "origin is not $REPO (host/path mismatch)"; fi
case "$branch" in
  main|master|HEAD) bad "on '$branch': feature-branch work only, never push this";;
  claude/*) ok "branch $branch";;
  *) bad "branch '$branch' is not under claude/*";;
esac

if [ "${1:-}" = "receipt" ]; then
  local_sha=$(git rev-parse HEAD)
  remote_sha=$(git ls-remote origin "refs/heads/$branch" | cut -f1)
  say "local  HEAD: $local_sha"
  say "remote $branch: ${remote_sha:-<none>}"
  if [ -n "$remote_sha" ] && [ "$remote_sha" = "$local_sha" ]; then ok "remote SHA matches local HEAD"; else bad "remote SHA does not match local HEAD"; fi
  prs=$(gh api "repos/$REPO/pulls?state=open&head=crankcase23:$branch" --jq 'length' 2>/dev/null) || prs=""
  if [ -n "$prs" ]; then say "open PRs for this branch: $prs"; else bad "could not query PRs (report this, do not assume none exist)"; fi
  main_now=$(git ls-remote origin refs/heads/main | cut -f1)
  main_then=$(cat "$gitdir/preflight-main-sha" 2>/dev/null || true)
  if [ -n "$main_then" ] && [ "$main_then" != "$main_now" ]; then note "main moved since preflight ($main_then -> $main_now). Someone merged; confirm it was not this session."; fi
  exit $fail
fi

# 2. working tree: show it; the agent confirms it is only intended changes
git status --short > "$tmp/status"
if [ -s "$tmp/status" ]; then say "working tree changes (confirm all are intended):"; sed 's/^/      /' "$tmp/status"; else ok "working tree clean"; fi

# 3. what would be pushed: a diff that cannot be computed is a failure, not an empty diff
git fetch -q origin main 2>/dev/null || bad "could not fetch origin/main; comparisons would use a stale ref"
if ! git rev-parse --verify -q "$BASE" >/dev/null; then bad "$BASE does not exist locally"
elif ! git merge-base "$BASE" HEAD >/dev/null 2>&1; then bad "no merge base with $BASE (shallow clone?): run 'git fetch --deepen=200 origin main'"
else
  git ls-remote origin refs/heads/main | cut -f1 > "$gitdir/preflight-main-sha" 2>/dev/null || true
  committed=$(git diff --name-only "$BASE...HEAD") || bad "git diff against $BASE failed"
  worktree=$(git diff --name-only HEAD) || bad "git diff HEAD failed"
  untracked=$(git ls-files -o --exclude-standard) || bad "git ls-files failed"
  changed=$(printf '%s\n%s\n%s\n' "$committed" "$worktree" "$untracked" | sed '/^$/d' | sort -u)
  gen_re='(^|/)(node_modules|\.next|\.vercel)/|\.tsbuildinfo$|(^|/)next-env\.d\.ts$|(^|/)\.env($|\.)'
  hits=$(printf '%s\n' "$changed" | grep -E "$gen_re" || true)
  if [ -n "$hits" ]; then bad "generated or env files in diff: $(echo $hits)"; else ok "no generated/env files in diff"; fi

  secret_re='ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|gh[ousr]_[A-Za-z0-9]{20,}|(^|[^A-Za-z0-9_-])sk-(ant-|proj-)?[A-Za-z0-9_-]{20,}|(sk|rk|pk)_(live|test)_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9]{16,}|npg_[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}|postgres(ql)?://[^ :@/]+:[^ @]+@|(DATABASE_URL|AUTH_SECRET|NEXTAUTH_SECRET|API_KEY|API_TOKEN|SECRET_KEY)[ ]*=[ ]*[^ ]{8,}|(api[_-]?key|secret|token|passwd|password)["'"'"']?[ ]*[:=][ ]*["'"'"'][A-Za-z0-9/+_.-]{16,}'
  { git diff "$BASE...HEAD"; git diff HEAD; git ls-files -o --exclude-standard -z | xargs -0 -r grep -I -n -H '' ; } 2>/dev/null | grep -E '^\+[^+]|^[^+@ d-][^:]*:[0-9]+:' > "$tmp/added" || true
  if grep -Eq "$secret_re" "$tmp/added"; then bad "possible credential in added/new lines (pattern match); review before pushing"; else ok "no credential patterns in added/new lines (committed, uncommitted, untracked)"; fi

  guard_re='^(\.claude/|CLAUDE\.md$|AGENTS\.md$|scripts/github-preflight\.sh$|package(-lock)?\.json$|vercel\.json$|next\.config\.|(src/)?middleware\.|\.github/|drizzle|\.env)'
  prot=$(printf '%s\n' "$changed" | grep -E "$guard_re" || true)
  if [ -n "$prot" ]; then note "OWNER-REVIEW paths touched (say so in the PR body): $(echo $prot)"; fi
fi

# 4. validation. Anything that cannot run is a failure.
npx --no-install next typegen >"$tmp/typegen" 2>&1 || bad "next typegen failed (tsc would run on stale route types): $(tail -3 "$tmp/typegen")"
if npx --no-install tsc --noEmit >"$tmp/tsc" 2>&1; then ok "tsc --noEmit clean"; else bad "tsc errors:"; head -20 "$tmp/tsc"; fi
git checkout -- next-env.d.ts 2>/dev/null || true

npx --no-install eslint -f json -o "$tmp/lint.json" >/dev/null 2>&1
if [ ! -s "$tmp/lint.json" ]; then bad "eslint produced no report (it failed to run)"; else
  lint_files=$(node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const cwd=process.cwd()+"/";for(const f of r)if(f.errorCount+f.warningCount>0)console.log(f.filePath.replace(cwd,"")+"\t"+f.errorCount+"e/"+f.warningCount+"w")' "$tmp/lint.json") || { bad "eslint report unreadable"; lint_files=""; }
  if [ -z "$lint_files" ]; then ok "eslint clean"; else
    say "eslint problems in:"; printf '%s\n' "$lint_files" | sed 's/^/      /'
    touched=$(comm -12 <(printf '%s\n' "$lint_files" | cut -f1 | sort -u) <(printf '%s\n' "${changed:-}" | sort -u))
    if [ -n "$touched" ]; then bad "eslint problems in files this branch touches (compare with $BASE before calling them pre-existing): $(echo $touched)"; else ok "all eslint problems are in files this branch does not touch (pre-existing)"; fi
  fi
fi

if [ "${2:-}" = "--build" ]; then
  if npx --no-install next build >"$tmp/build" 2>&1; then ok "next build succeeds"; else bad "next build failed:"; tail -25 "$tmp/build"; fi
  git checkout -- next-env.d.ts 2>/dev/null || true
else say "skip: next build (pass --build)"; fi

say; if [ $fail -eq 0 ]; then say "PREFLIGHT PASS (branch $branch @ $(git rev-parse --short HEAD))"; else say "PREFLIGHT FAIL: fix or report, do not push"; fi
exit $fail
