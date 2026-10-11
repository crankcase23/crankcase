#!/usr/bin/env bash
# GitHub preflight for feature-branch work. Read-only: never commits, pushes, or merges.
#   bash scripts/github-preflight.sh check [--build]   run before committing/pushing
#   bash scripts/github-preflight.sh receipt            run after pushing; verifies remote SHA == local HEAD
# Rules live in CLAUDE.md ("GitHub workflow"). Exit code != 0 means: do not push.
set -u
REPO="crankcase23/crankcase"
BASE="origin/main"
fail=0
say() { printf '%s\n' "$*"; }
bad() { say "FAIL: $*"; fail=1; }
ok()  { say "ok:   $*"; }

cd "$(git rev-parse --show-toplevel)" || exit 2
branch=$(git rev-parse --abbrev-ref HEAD)
url=$(git remote get-url origin 2>/dev/null || true)

# 1. repository and branch
case "$url" in *"$REPO"*) ok "origin is $REPO";; *) bad "origin is '$url', expected $REPO";; esac
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
  [ -n "$remote_sha" ] && [ "$remote_sha" = "$local_sha" ] && ok "remote SHA matches local HEAD" || bad "remote SHA does not match local HEAD"
  prs=$(gh api "repos/$REPO/pulls?state=open&head=crankcase23:$branch" --jq 'length' 2>/dev/null || echo "?")
  say "open PRs for this branch: $prs"
  exit $fail
fi

# 2. working tree: show it; the human/agent confirms it is only intended changes
git status --short > /tmp/gh-preflight-status.$$
if [ -s /tmp/gh-preflight-status.$$ ]; then say "working tree changes (confirm all are intended):"; sed 's/^/      /' /tmp/gh-preflight-status.$$; else ok "working tree clean"; fi
rm -f /tmp/gh-preflight-status.$$

# 3. accidental generated files and credentials in what would be pushed
git fetch -q origin main 2>/dev/null || say "warn: could not fetch origin/main; comparing against stale ref"
range="$BASE...HEAD"
changed=$( { git diff --name-only "$range"; git diff --name-only HEAD; git diff --name-only --cached; } | sort -u)
echo "$changed" | grep -E '(^|/)(node_modules|\.next|\.vercel)/|\.tsbuildinfo$|(^|/)next-env\.d\.ts$|(^|/)\.env($|\.)' >/dev/null && bad "generated or env files in diff: $(echo "$changed" | grep -E '(^|/)(node_modules|\.next|\.vercel)/|\.tsbuildinfo$|(^|/)next-env\.d\.ts$|(^|/)\.env($|\.)' | tr '\n' ' ')" || ok "no generated/env files in diff"
secret_re='ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|gh[ousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|postgres(ql)?://[^ :@/]+:[^ @/]+@|(DATABASE_URL|AUTH_SECRET|NEXTAUTH_SECRET)=[^ ]{8,}'
if { git diff "$range"; git diff HEAD; } | grep -E '^\+[^+]' | grep -Eq "$secret_re"; then bad "possible credential in added lines (pattern match); review before pushing"; else ok "no credential patterns in added lines"; fi

# 4. validation
npx next typegen >/dev/null 2>&1
if npx tsc --noEmit >/tmp/gh-preflight-tsc.$$ 2>&1; then ok "tsc --noEmit clean"; else bad "tsc errors:"; head -20 /tmp/gh-preflight-tsc.$$; fi
rm -f /tmp/gh-preflight-tsc.$$
git checkout -- next-env.d.ts 2>/dev/null || true

lint_json=$(mktemp)
npx eslint -f json -o "$lint_json" >/dev/null 2>&1
if [ ! -s "$lint_json" ]; then bad "eslint produced no report (eslint itself failed to run)"; lint_files=""; else
  lint_files=$(node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const cwd=process.cwd()+"/";for(const f of r)if(f.errorCount+f.warningCount>0)console.log(f.filePath.replace(cwd,"")+" ("+f.errorCount+"e/"+f.warningCount+"w)")' "$lint_json" | sort -u)
fi
rm -f "$lint_json"
if [ -z "$lint_files" ]; then ok "eslint clean"; else
  say "eslint problems in:"; echo "$lint_files" | sed 's/^/      /'
  touched=$(comm -12 <(echo "$lint_files" | sed -E 's/ \([0-9]+e\/[0-9]+w\)$//') <(echo "$changed"))
  if [ -n "$touched" ]; then bad "eslint problems in files this branch touches (compare against $BASE before calling them pre-existing): $touched"; else ok "all eslint problems are in files this branch does not touch (pre-existing)"; fi
fi

if [ "${2:-}" = "--build" ] || [ "${1:-}" = "--build" ]; then
  if npx next build >/tmp/gh-preflight-build.$$ 2>&1; then ok "next build succeeds"; else bad "next build failed:"; tail -25 /tmp/gh-preflight-build.$$; fi
  rm -f /tmp/gh-preflight-build.$$
  git checkout -- next-env.d.ts 2>/dev/null || true
else say "skip: next build (pass --build)"; fi

say; [ $fail -eq 0 ] && say "PREFLIGHT PASS (branch $branch @ $(git rev-parse --short HEAD))" || say "PREFLIGHT FAIL: fix or report, do not push"
exit $fail
