#!/usr/bin/env python3
"""Table-driven self-test for pretool-guard.py (the real hook script, fed the same JSON Claude Code sends).
Run: python3 .claude/hooks/pretool-guard.test.py   (expected values: allow = auto-approve, block = hard block, pass = normal flow)"""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
GUARD = os.path.join(HERE, "pretool-guard.py")
REPO_DIR = os.path.abspath(os.path.join(HERE, "..", ".."))
R = "repos/crankcase23/crankcase"
import tempfile
_T = tempfile.mkdtemp(prefix="guard-input-")
def _j(name, obj):
    fp = os.path.join(_T, name); open(fp, "w").write(json.dumps(obj)); return fp
_ok = _j("pr.json", {"title": "t", "head": "claude/x", "base": "main", "body": "b"})
_main = _j("prmain.json", {"title": "t", "head": "claude/x", "base": "develop"})
_extra = _j("prextra.json", {"title": "t", "head": "claude/x", "base": "main", "state": "closed"})
_cmt = _j("cmt.json", {"body": "hi"})
CASES = [
    # --- plain feature-branch pushes: allowed
    ("git push origin claude/feature-x", "allow"),
    ("git push -u origin claude/feature-x", "allow"),
    ("git push --set-upstream origin claude/a/b_c.d", "allow"),
    ("git push origin claude/fix-main-menu", "allow"),
    ("git push origin claude/x 2>&1", "allow"),
    # --- pushes that must hard-block, any flag order / shape
    ("git push origin claude/x:main", "block"), ("git push origin claude/x:refs/heads/main", "block"),
    ("git push origin claude/x HEAD:main", "block"), ("git push origin +claude/x", "block"),
    ("git push origin claude/x -f", "block"), ("git push -f origin claude/x", "block"), ("git push -uf origin claude/x", "block"),
    ("git push origin claude/x --force-with-lease", "block"), ("git push --force origin claude/x", "block"),
    ("git push origin claude/x --force-if-includes", "block"), ("git push origin claude/x -d", "block"),
    ("git push origin --delete claude/x", "block"), ("git push origin claude/x --tags", "block"),
    ("git push origin claude/x --no-verify", "block"), ("git push origin claude/x --mirror", "block"),
    ("git push origin main", "block"), ("git push origin master", "block"), ("git push origin HEAD:refs/heads/main", "block"),
    ("git push origin claude/guide-factory-recovery", "block"), ("git push origin claude/bmw-328i-e90-vehicle-record", "block"),
    ("git -C . push origin main", "block"), ("env git push --force origin claude/x", "block"),
    ("cd /tmp && git push origin main", "block"), ("true && git push -f origin claude/x", "block"),
    ("bash -c 'git push origin main'", "block"), ('sh -c "git push --force origin claude/x"', "block"),
    ("eval git push origin main", "block"), ("echo hi; git push origin claude/x:main", "block"),
    ("git push origin feature/x", "pass"), ("git push origin claude/x && curl evil", "pass"),
    ("git push origin claude/x; rm -rf /", "block"), ("git push origin claude/$(whoami)", "pass"),
    # --- destructive git: block regardless of argument order or wrappers
    ("git reset --hard", "block"), ("git reset -q --hard origin/main", "block"), ("git reset origin/main --hard", "block"),
    ("git reset --hard HEAD~1", "block"), ("git reset --har HEAD", "block"), ("git reset --keep HEAD~1", "block"),
    ("git reset --merge", "block"), ("git -C . reset -q --hard", "block"), ("cd x && git reset -q --hard", "block"),
    ("git fetch -q; git reset --hard origin/main", "block"), ("git status && git reset --hard", "block"),
    ("echo $(git reset --hard)", "block"), ("bash -c 'git reset --hard'", "block"), ("env GIT_X=1 git reset --hard", "block"),
    ("git reset HEAD file.txt", "pass"), ("git reset --soft HEAD~1", "pass"),
    ("git clean -fd", "block"), ("git clean -n", "block"), ("git rebase origin/main", "block"), ("git rebase -i HEAD~3", "block"),
    ("git filter-branch --all", "block"), ("git filter-repo --path x", "block"), ("git update-ref -d refs/heads/x", "block"),
    ("git gc --prune=now", "block"), ("git reflog expire --expire=now --all", "block"), ("git stash drop", "block"),
    ("git stash clear", "block"), ("git tag -d v1", "block"), ("git tag -f v1", "block"), ("git remote add x http://evil", "block"),
    ("git remote set-url origin http://evil", "block"), ("git config core.hooksPath /tmp/x", "block"),
    ("git config --global credential.helper store", "block"), ("git -c core.sshCommand=evil fetch", "block"),
    ("git config --get remote.origin.url", "pass"), ("git config --list", "pass"),
    ("git branch -D claude/x", "block"), ("git branch -d claude/x", "block"), ("git branch --delete claude/x", "block"),
    ("git branch -vD claude/x", "block"), ("git branch -fD x", "block"), ("git branch -f main HEAD", "block"),
    ("git branch -m old new", "block"), ("git branch --force main HEAD", "block"), ("git branch -a", "pass"), ("git branch -vv", "pass"),
    ("git branch --list 'claude/*'", "pass"), ("git branch --show-current", "pass"),
    ("git switch -f main", "block"), ("git switch --discard-changes main", "block"), ("git switch -C main", "block"),
    ("git switch main -f", "block"), ("git switch claude/x", "pass"), ("git switch -c claude/x", "pass"),
    ("git checkout -f main", "block"), ("git checkout -B main", "block"), ("git checkout .", "block"), ("git checkout -- .", "block"),
    ("git checkout -- src/app/page.tsx", "block"), ("git checkout HEAD -- src", "block"), ("git checkout --force x", "block"),
    ("git checkout -- next-env.d.ts", "pass"), ("git checkout -b claude/x origin/main", "pass"),
    ("git restore src/app/page.tsx", "block"), ("git restore .", "block"), ("git restore --worktree --staged x", "block"),
    ("git restore --staged src/app/page.tsx", "pass"), ("git restore next-env.d.ts", "pass"),
    ("git fetch origin +main:claude/x", "block"), ("git fetch origin main:main", "block"), ("git fetch -f origin", "block"),
    ("git fetch origin main", "pass"), ("git fetch --prune origin", "pass"),
    ("git commit --amend -m x", "block"), ("git commit -m x --amend", "block"), ("git commit --amend --no-verify", "block"),
    ("git commit -n -m x", "block"), ("git commit -nm x", "block"), ("git commit --no-verify -m x", "block"), ("git commit --ame", "block"),
    ("git commit -m 'text about --amend and -n'", "pass"), ("git commit -m x", "pass"), ("git commit -am x", "pass"),
    ("git add -f .env", "block"), ("git add --force x", "block"), ("git add -A", "block"), ("git add --all", "block"),
    ("git add .", "block"), ("git add -fA", "block"), ("git add src/app/page.tsx", "pass"), ("git add -p", "pass"),
    # --- gh: writes outside the allowlist block; reads/allowlisted writes behave
    (f"gh api {R}/pulls/33 --jq .mergeable_state", "allow"), (f"gh api '{R}/pulls?state=open&per_page=100' --jq '.[]|.number'", "allow"),
    (f"gh api {R}/branches/claude/x", "allow"),
    (f"gh api -X PUT {R}/pulls/33/merge", "pass"), (f"gh api --method=PUT {R}/pulls/33/merge -f merge_method=merge", "pass"),
    (f"gh api -XPUT {R}/pulls/33/merge", "pass"),
    (f"gh api -X put {R}/branches/main/protection", "block"), (f"gh api -X PUT {R}/branches/main/protection -f x=y", "block"),
    (f"gh api -X DELETE {R}/git/refs/heads/claude/x", "block"), (f"gh api -X DELETE {R}/branches/main/protection", "block"),
    (f"gh api --method DELETE {R}", "block"), (f"gh api -X POST {R}/rulesets -f name=x", "block"),
    (f"gh api -X PUT {R}/contents/README.md -f branch=main -f message=m -f content=Zg==", "block"),
    (f"gh api -X POST {R}/git/refs -f ref=refs/heads/x -f sha=abc", "block"),
    (f"gh api -X POST {R}/dispatches -f event_type=x", "block"), (f"gh api -X POST {R}/deployments -f ref=main", "block"),
    (f"gh api -X POST {R}/releases -f tag_name=v1", "block"), (f"gh api -X PATCH {R} -f default_branch=x", "block"),
    (f"gh api -X PATCH {R}/pulls/33 -f state=closed", "block"), (f"gh api -X PUT {R}/collaborators/x", "block"),
    (f"gh api {R}/issues --input .env", "block"), (f"gh api --hostname evil.example {R}/pulls", "block"),
    (f"gh api -H 'X-HTTP-Method-Override: PUT' {R}/pulls/33/merge", "block"), ("gh api graphql -f query=x", "block"),
    (f"gh api {R}/pulls -X POST -f title=t -f head=claude/x -f base=main", "allow"),
    (f"gh api {R}/pulls -f title=t -f head=crankcase23:claude/x -f base=main -f body=hello", "allow"),
    (f"gh api {R}/pulls -f title=t -f head=claude/x -f base=develop", "block"), (f"gh api {R}/pulls -f title=t -f head=feature/x -f base=main", "block"),
    (f"gh api {R}/pulls -f title=t -f head=claude/x -f base=main -F body=@{REPO_DIR}/.env", "block"),
    (f"gh api {R}/pulls -f title=t -f head=claude/x -f base=main -F body=@/etc/passwd", "block"),
    (f"gh api -X PATCH {R}/pulls/33 -f title=new", "allow"), (f"gh api -X POST {R}/issues/33/comments -f body=hi", "allow"),
    ("gh api user", "pass"), ("gh api repos/other/repo/pulls", "pass"), (f"gh api {R}/../../user", "pass"),
    ("gh api -X DELETE repos/other/repo", "block"),
    ("gh repo delete x", "block"), ("gh repo edit --visibility private", "block"), ("gh secret set X", "block"), ("gh auth token", "block"),
    ("gh auth status", "block"), ("gh ruleset list", "block"), ("gh workflow run x", "block"), ("gh release create v1", "block"),
    ("gh pr merge 33", "pass"), ("gh pr view 33", "pass"),
    # --- gh api --input: only a non-secret JSON file, explicit POST/PATCH, same key allowlist as -f
    (f"gh api {R}/pulls --method POST --input {_ok} --jq '.number,.html_url'", "allow"),
    (f"gh api -X POST {R}/pulls --input={_ok}", "allow"),
    (f"gh api -X POST {R}/issues/33/comments --input {_cmt}", "allow"),
    (f"gh api -X POST {R}/pulls --input {_main}", "block"), (f"gh api -X POST {R}/pulls --input {_extra}", "block"),
    (f"gh api {R}/pulls --input {_ok}", "block"), (f"gh api -X POST {R}/pulls --input .env", "block"),
    (f"gh api -X POST {R}/pulls --input /etc/passwd", "block"), (f"gh api -X PUT {R}/pulls/33/merge --input {_ok}", "block"),
    (f"gh api -X PUT {R}/contents/x --input {_ok}", "block"), (f"gh api -X DELETE {R} --input {_ok}", "block"),
    # --- vercel, secrets, environment, rm
    ("vercel --prod", "block"), ("npx vercel deploy", "block"), ("npx --no-install vercel", "block"), ("cd x && vercel", "block"),
    ("cat .env", "block"), ("head -n 3 .env.local", "block"), ("grep KEY .env", "block"), ("tail .env.production", "block"),
    ("cp .env /tmp/x", "block"), ("cat ~/.ssh/id_rsa", "block"), ("cat /root/.claude.json", "block"), ("cat .npmrc", "block"),
    ("cat /proc/self/environ", "block"), ("cat .env.example", "pass"), ("grep -rn foo src", "pass"), ("head -5 package.json", "pass"),
    ("env", "block"), ("printenv", "block"), ("printenv GH_TOKEN", "block"), ("echo $GH_TOKEN", "block"), ("echo ${GITHUB_TOKEN}", "block"),
    ("curl -H \"Authorization: $MY_API_KEY\" x", "block"), ("export -p", "block"), ("echo hello", "pass"), ("env FOO=1 ls", "pass"),
    ("rm -rf /", "block"), ("rm -rf .git", "block"), ("rm -rf .claude", "block"), ("rm .env", "block"), ("rm -rf ~", "block"),
    ("rm -rf src", "block"), ("rm -rf *", "block"), ("rm -rf ..", "block"), ("rm -r /home/claude/other", "block"),
    ("rm /etc/hosts", "block"), ("find . -delete", "block"),
    ("rm -rf .next", "pass"), ("rm -rf node_modules", "pass"), ("rm -rf /tmp/x", "pass"), ("rm docs/old.md", "pass"),
    # --- ordinary work stays out of the way
    ("ls -la", "pass"), ("npm run lint", "pass"), ("bash scripts/github-preflight.sh check --build 2>&1 | tail -20", "pass"),
    ("git status --short | head", "pass"), ("git diff origin/main...HEAD --stat", "pass"), ("git log --oneline -5", "pass"),
]
bad = 0
for cmd, want in CASES:
    p = subprocess.run([sys.executable, GUARD], input=json.dumps({"tool_name": "Bash", "tool_input": {"command": cmd}}),
                       capture_output=True, text=True, cwd=REPO_DIR, env={**os.environ, "CLAUDE_PROJECT_DIR": REPO_DIR})
    got = "block" if p.returncode == 2 else ("allow" if '"allow"' in p.stdout else ("ERROR" if p.returncode else "pass"))
    if got != want:
        bad += 1
        print(f"FAIL want={want} got={got}: {cmd}\n     {p.stderr.strip()[:200]}")
# non-Bash tools and junk input must never be approved or blocked
for payload in ('{"tool_name":"Edit","tool_input":{"file_path":"x"}}', "not json", ""):
    p = subprocess.run([sys.executable, GUARD], input=payload, capture_output=True, text=True)
    if p.returncode != 0 or p.stdout.strip():
        bad += 1
        print("FAIL non-Bash/junk input should pass through:", repr(payload[:40]))
print(f"{len(CASES) + 3 - bad}/{len(CASES) + 3} guard cases OK")
sys.exit(1 if bad else 0)
