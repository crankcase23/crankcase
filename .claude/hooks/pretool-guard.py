#!/usr/bin/env python3
"""PreToolUse guard for Bash (Crankcase Garage autonomous GitHub workflow).

Fail-safe design: this hook can only AUTO-APPROVE a short list of exact, safe command shapes, or HARD-BLOCK
(exit 2) obviously dangerous push shapes. For everything else it prints nothing and exits 0, so Claude Code's normal
permission flow applies (deny rules, then a prompt). If this file crashes or python is missing, nothing is auto-approved.

Auto-approved:
  git push [-u|--set-upstream] origin claude/<name>          (one plain refspec; never the two long-lived branches)
  gh api GET repos/crankcase23/crankcase/...                  (reads)
  gh api POST repos/crankcase23/crankcase/pulls               (head claude/*, base main)
  gh api PATCH repos/crankcase23/crankcase/pulls/<n>          (title/body only)
  gh api POST repos/crankcase23/crankcase/issues/<n>/comments (body only)
Everything else (merge, protection, deployments, contents writes, DELETE/PUT, ...) is NOT approved here.

Guardrail, not a security boundary: the real boundary for `main` is GitHub branch protection (owner-controlled).
"""
import json
import os
import re
import shlex
import sys

REPO = "crankcase23/crankcase"
HOLD_BRANCHES = {"claude/guide-factory-recovery", "claude/bmw-328i-e90-vehicle-record"}  # owner-approval before any push
BRANCH_RE = re.compile(r"^claude/[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$")
SECRET_FILE_RE = re.compile(r"(^|/)\.env|id_rsa|\.pem$|\.key$|credentials|\.npmrc|\.netrc", re.I)
SAFE_FILE_ROOTS = ("/tmp/", "/home/claude/")


def allow(reason):
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow",
                                             "permissionDecisionReason": reason}}))
    sys.exit(0)


def block(reason):
    print("BLOCKED by .claude/hooks/pretool-guard.py: " + reason, file=sys.stderr)
    sys.exit(2)


def passthrough():
    sys.exit(0)


def tokenize(cmd):
    """Return tokens, or None if the command is compound/complex (then we approve nothing)."""
    if "`" in cmd or "$(" in cmd or "${" in cmd or "\n" in cmd:
        return None
    lex = shlex.shlex(cmd, posix=True, punctuation_chars=True)
    lex.whitespace_split = True
    try:
        toks = list(lex)
    except ValueError:
        return None
    if any(re.fullmatch(r"[;&|<>()]+", t) for t in toks):
        return None
    return toks


def check_git_push(toks):
    args = toks[2:]
    flags = [a for a in args if a.startswith("-")]
    pos = [a for a in args if not a.startswith("-")]
    joined = " ".join(args)
    long_bad = ("--force", "--delete", "--mirror", "--all", "--tags", "--prune", "--no-verify")
    dangerous = any(f.startswith(long_bad) for f in flags if f.startswith("--")) or any(
        re.fullmatch(r"-[A-Za-z]+", f) and re.search(r"[fdn]", f[1:]) for f in flags)
    if dangerous or any(":" in p or p.startswith("+") for p in pos) or re.search(r"(^|[ /:+])(main|master)( |$)", joined):
        block("push shape is forced/delete/multi-ref or targets main. Feature-branch plain pushes only; "
              "anything else needs the owner.")
    if any(f not in ("-u", "--set-upstream") for f in flags):
        return passthrough()
    if len(pos) != 2 or pos[0] != "origin" or not BRANCH_RE.match(pos[1]) or ".." in pos[1] or pos[1].endswith(".lock"):
        return passthrough()
    if pos[1] in HOLD_BRANCHES:
        block(f"{pos[1]} holds unmerged work awaiting owner approval; do not push to it autonomously.")
    allow(f"plain feature-branch push to {pos[1]}")


def safe_body_file(value):
    path = os.path.realpath(value[1:])
    return path.startswith(SAFE_FILE_ROOTS) and not SECRET_FILE_RE.search(path)


def check_gh_api(toks):
    method, fields, path, i = None, [], None, 2
    while i < len(toks):
        t = toks[i]
        if t in ("-X", "--method") and i + 1 < len(toks):
            method = toks[i + 1].upper(); i += 2; continue
        if t.startswith("--method="):
            method = t.split("=", 1)[1].upper(); i += 1; continue
        if re.fullmatch(r"-X[A-Za-z]+", t):
            method = t[2:].upper(); i += 1; continue
        if t in ("-f", "-F", "--field", "--raw-field") and i + 1 < len(toks):
            fields.append(toks[i + 1]); i += 2; continue
        if t.startswith(("--field=", "--raw-field=")):
            fields.append(t.split("=", 1)[1]); i += 1; continue
        if t in ("-q", "--jq") and i + 1 < len(toks):
            i += 2; continue
        if t in ("--paginate", "--slurp", "-i", "--include", "--silent"):
            i += 1; continue
        if t.startswith("-"):
            return passthrough()  # --input, -H, --hostname, --cache, templates, anything unknown
        if path is None:
            path = t; i += 1; continue
        return passthrough()
    if path is None:
        return passthrough()
    path = path.split("?", 1)[0].lstrip("/")
    if ".." in path or "%" in path or not re.fullmatch(rf"repos/{re.escape(REPO)}(/.*)?", path):
        return passthrough()
    keys = {}
    for f in fields:
        if "=" not in f:
            return passthrough()
        k, v = f.split("=", 1)
        keys[k] = v
        if v.startswith("@") and not (method in ("POST", "PATCH") and safe_body_file(v)):
            return passthrough()
    effective = method or ("POST" if fields else "GET")
    if effective == "GET":
        if any(v.startswith("@") for v in keys.values()):
            return passthrough()
        allow("read-only GitHub REST call on this repo")
    sub = path[len(f"repos/{REPO}"):].strip("/")
    if effective == "POST" and sub == "pulls":
        head = keys.get("head", "")
        head = head.split(":", 1)[1] if head.startswith(f"{REPO.split('/')[0]}:") else head
        if set(keys) <= {"title", "body", "head", "base", "draft", "maintainer_can_modify"} \
                and {"title", "head", "base"} <= set(keys) and BRANCH_RE.match(head) and keys["base"] == "main":
            allow("open a PR from a claude/* branch into main")
    elif effective == "PATCH" and re.fullmatch(r"pulls/\d+", sub):
        if keys and set(keys) <= {"title", "body"}:
            allow("update PR title/body")
    elif effective == "POST" and re.fullmatch(r"issues/\d+/comments", sub):
        if set(keys) == {"body"}:
            allow("comment on a PR/issue")
    return passthrough()


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return passthrough()
    if data.get("tool_name") != "Bash":
        return passthrough()
    cmd = (data.get("tool_input") or {}).get("command", "").strip()
    toks = tokenize(cmd)
    if not toks:
        return passthrough()
    if toks[:2] == ["git", "push"]:
        return check_git_push(toks)
    if toks[:2] == ["gh", "api"]:
        return check_gh_api(toks)
    return passthrough()


if __name__ == "__main__":
    main()
