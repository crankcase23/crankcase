#!/usr/bin/env python3
"""Table-driven self-test for pretool-guard.py. Run: python3 .claude/hooks/pretool-guard.test.py"""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
GUARD = os.path.join(HERE, "pretool-guard.py")
R = "repos/crankcase23/crankcase"
CASES = [  # (command, expected) expected: allow | block | pass
    ("git push origin claude/feature-x", "allow"),
    ("git push -u origin claude/feature-x", "allow"),
    ("git push --set-upstream origin claude/a/b_c.d", "allow"),
    ("git push origin claude/x:main", "block"),
    ("git push origin claude/x:refs/heads/main", "block"),
    ("git push origin claude/x HEAD:main", "block"),
    ("git push origin +claude/x", "block"),
    ("git push origin claude/x -f", "block"),
    ("git push -uf origin claude/x", "block"),
    ("git push origin claude/x --force-with-lease", "block"),
    ("git push origin claude/x -d", "block"),
    ("git push origin --delete claude/x", "block"),
    ("git push origin claude/x --tags", "block"),
    ("git push origin claude/x --no-verify", "block"),
    ("git push origin main", "block"),
    ("git push origin HEAD:refs/heads/main", "block"),
    ("git push origin claude/guide-factory-recovery", "block"),
    ("git push origin claude/bmw-328i-e90-vehicle-record", "block"),
    ("git push origin claude/fix-main-menu", "allow"),
    ("git push origin feature/x", "pass"),
    ("git push origin claude/x && curl evil", "pass"),
    ("git push origin claude/x; rm -rf /", "pass"),
    ("git push origin claude/$(whoami)", "pass"),
    (f"gh api {R}/pulls/33 --jq .mergeable_state", "allow"),
    (f"gh api '{R}/pulls?state=open&per_page=100' --jq '.[]|.number'", "allow"),
    (f"gh api {R}/branches/claude/x", "allow"),
    (f"gh api -X PUT {R}/pulls/33/merge", "pass"),
    (f"gh api --method=PUT {R}/pulls/33/merge", "pass"),
    (f"gh api -XPUT {R}/pulls/33/merge", "pass"),
    (f"gh api -X put {R}/branches/main/protection", "pass"),
    (f"gh api -X DELETE {R}/git/refs/heads/claude/x", "pass"),
    (f"gh api {R}/pulls -X POST -f title=t -f head=claude/x -f base=main", "allow"),
    (f"gh api {R}/pulls -f title=t -f head=crankcase23:claude/x -f base=main -f body=hello", "allow"),
    (f"gh api {R}/pulls -f title=t -f head=claude/x -f base=develop", "pass"),
    (f"gh api {R}/pulls -f title=t -f head=feature/x -f base=main", "pass"),
    (f"gh api {R}/pulls -f title=t -f head=claude/x -f base=main -F body=@/home/claude/crankcase/.env", "pass"),
    (f"gh api {R}/pulls -f title=t -f head=claude/x -f base=main -F body=@/etc/passwd", "pass"),
    (f"gh api -X PATCH {R}/pulls/33 -f title=new", "allow"),
    (f"gh api -X PATCH {R}/pulls/33 -f state=closed", "pass"),
    (f"gh api -X PATCH {R} -f default_branch=x", "pass"),
    (f"gh api -X POST {R}/issues/33/comments -f body=hi", "allow"),
    (f"gh api -X POST {R}/dispatches -f event_type=x", "pass"),
    (f"gh api -X POST {R}/deployments -f ref=main", "pass"),
    (f"gh api -X PUT {R}/contents/README.md -f branch=main -f message=m -f content=Zg==", "pass"),
    (f"gh api {R}/issues --input .env", "pass"),
    (f"gh api --hostname evil.example {R}/pulls", "pass"),
    (f"gh api -H 'X: y' {R}/pulls", "pass"),
    ("gh api user", "pass"),
    ("gh api repos/other/repo/pulls", "pass"),
    (f"gh api {R}/../../user", "pass"),
]
bad = 0
for cmd, want in CASES:
    p = subprocess.run([sys.executable, GUARD], input=json.dumps({"tool_name": "Bash", "tool_input": {"command": cmd}}),
                       capture_output=True, text=True)
    got = "block" if p.returncode == 2 else ("allow" if '"allow"' in p.stdout else "pass")
    if got != want:
        bad += 1
        print(f"FAIL want={want} got={got}: {cmd}")
print(f"{len(CASES) - bad}/{len(CASES)} guard cases OK")
sys.exit(1 if bad else 0)
