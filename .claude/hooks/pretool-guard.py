#!/usr/bin/env python3
"""PreToolUse guard for Bash (Crankcase Garage autonomous GitHub workflow), v2.

Fail-safe design. This hook does exactly two things, and otherwise prints nothing and exits 0 so Claude Code's normal
permission flow applies (deny/ask rules, then a prompt). If this file crashes or python is missing, nothing is auto-approved.

1. HARD-BLOCK (exit 2) dangerous command shapes, checked on EVERY segment of a compound command (`;` `&&` `||` `|`,
   `$(...)`, backticks, `bash -c`, `eval`, `env`/`sudo`/`xargs` wrappers) and independent of flag order or bundling:
   destructive git (reset --hard, clean, rebase, branch/tag deletion, history rewrites, forced/ref-updating push, fetch
   refspecs, config/remote edits, `git -c`), pushes to main or the two held branches, GitHub writes outside the allowlist,
   `gh repo|secret|auth|ruleset|workflow|release`, vercel, reading secret files or token variables, dumping the
   environment, and recursive deletes outside build dirs.
2. AUTO-APPROVE (single simple command only):
     git push [-u|--set-upstream] origin claude/<name>
     gh api GET repos/crankcase23/crankcase/...
     gh api POST .../pulls (head claude/*, base main) | PATCH .../pulls/<n> (title/body) | POST .../issues/<n>/comments

Merging a PR (PUT .../pulls/<n>/merge, `gh pr merge`) is deliberately NOT blocked here: it falls through to the `ask`
rule, so it needs the owner's per-PR approval. Arbitrary code (python -c, node -e, scripts) can still do anything.
Guardrail, not a security boundary: the real boundary for `main` is GitHub branch protection (owner-controlled).
"""
import json
import os
import re
import shlex
import sys

REPO = "crankcase23/crankcase"
HOLD_BRANCHES = {"claude/guide-factory-recovery", "claude/bmw-328i-e90-vehicle-record"}  # owner approval before any push
BRANCH_RE = re.compile(r"^claude/[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$")
SECRET_FILE_RE = re.compile(
    r"(^|/)\.env($|\.(?!example$|sample$|template$))|id_rsa|id_ed25519|\.pem$|\.npmrc$|\.netrc$|\.credentials\.json|"
    r"\.claude\.json$|/proc/[^ ]*/environ|credentials$", re.I)
SECRET_VAR_RE = re.compile(r"\$\{?(GH_TOKEN|GITHUB_TOKEN|[A-Z0-9_]*(TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY)[A-Z0-9_]*)\b")
READERS = {"cat", "head", "tail", "grep", "egrep", "fgrep", "rg", "less", "more", "sed", "awk", "strings", "xxd", "od", "cut",
           "sort", "nl", "tac", "wc", "base64", "cp", "mv", "scp", "tee", "diff", "source", ".", "ls"}
SAFE_FILE_ROOTS = ("/tmp/", "/home/claude/")
RM_RECURSIVE_OK = {".next", "node_modules", "out", "build", "dist", "coverage", ".turbo"}
GH_BLOCKED_SUBS = {"repo", "secret", "auth", "ruleset", "variable", "ssh-key", "gpg-key", "codespace", "workflow", "release",
                   "extension", "alias", "config"}
WRAPPERS = {"env", "sudo", "command", "time", "nohup", "exec", "builtin", "nice", "stdbuf", "xargs", "timeout"}
SHELLS = {"bash", "sh", "zsh", "dash", "ksh"}


def allow(reason):
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow",
                                             "permissionDecisionReason": reason}}))
    sys.exit(0)


def block(reason):
    print("BLOCKED by .claude/hooks/pretool-guard.py: " + reason, file=sys.stderr)
    sys.exit(2)


def passthrough():
    sys.exit(0)


# ---------- parsing ----------
def lex(cmd):
    cmd = cmd.replace("`", ";").replace("$(", "; ").replace("\n", ";")
    lx = shlex.shlex(cmd, posix=True, punctuation_chars=True)
    lx.whitespace_split = True
    try:
        return list(lx)
    except ValueError:
        return None


def segments(cmd):
    """Split into simple-command segments with redirections removed. None if unparseable."""
    toks = lex(cmd)
    if toks is None:
        return None
    segs, cur, i = [], [], 0
    while i < len(toks):
        t = toks[i]
        if re.fullmatch(r"[;&|()]+", t):
            if cur:
                segs.append(cur)
            cur = []
        elif re.fullmatch(r"(>>?|<|>&|<&|&>|<<|<<<)", t):
            if cur and re.fullmatch(r"[0-9]+", cur[-1]):
                cur.pop()
            i += 1  # skip redirect target
        else:
            cur.append(t)
        i += 1
    if cur:
        segs.append(cur)
    return segs


def normalize(seg):
    seg = list(seg)
    while seg:
        t = seg[0]
        if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*=.*", t):
            seg.pop(0)
        elif t == "timeout" and len(seg) > 2:
            seg = seg[2:]
        elif t in WRAPPERS:
            seg.pop(0)
            while seg and seg[0].startswith("-"):
                seg.pop(0)
        else:
            break
    return seg


def opts_pos(args, value_flags=()):
    opts, pos, skip = [], [], False
    for a in args:
        if skip:
            skip = False
            continue
        if a in value_flags:
            skip = True
            continue
        (opts if a.startswith("-") and a != "-" else pos).append(a)
    return opts, pos


def cluster_has(opts, letters):
    return any(re.fullmatch(r"-[A-Za-z]+", o) and set(o[1:]) & set(letters) for o in opts)


def long_is(opts, names):
    return any(o.split("=", 1)[0] in names for o in opts)


# ---------- git ----------
def git_split(seg):
    i = 1
    while i < len(seg) and seg[i].startswith("-"):
        o = seg[i]
        if o == "-c" or (o.startswith("-c") and len(o) > 2 and not o.startswith("--")):
            block("`git -c` can inject config (hooks path, ssh command, credential helper).")
        i += 2 if o in ("-C", "--git-dir", "--work-tree", "--namespace", "--exec-path") else 1
    return (seg[i] if i < len(seg) else None), seg[i + 1:]


def push_shape(args):
    """Block dangerous pushes; return the branch for a plain push, else None."""
    opts, pos = opts_pos(args)
    joined = " ".join(args)
    bad_long = long_is(opts, {"--force", "--force-with-lease", "--force-if-includes", "--delete", "--mirror", "--all",
                              "--tags", "--prune", "--no-verify", "--follow-tags", "--receive-pack", "--exec", "--repo"}) \
        or any(o.startswith(("--force", "--delete", "--mir", "--prun", "--no-v")) for o in opts)
    if bad_long or cluster_has(opts, "fdn") or any(":" in p or p.startswith("+") for p in pos) \
            or re.search(r"(^|[ /:+])(main|master)( |$)", joined):
        block("push is forced/delete/multi-ref or targets main. Plain feature-branch pushes only; "
              "anything else needs the owner.")
    if any(o not in ("-u", "--set-upstream") for o in opts):
        return None
    if len(pos) == 2 and pos[0] == "origin" and BRANCH_RE.match(pos[1]) and ".." not in pos[1] and not pos[1].endswith(".lock"):
        if pos[1] in HOLD_BRANCHES:
            block(f"{pos[1]} holds unmerged work awaiting owner approval; do not push to it autonomously.")
        return pos[1]
    return None


def check_git(seg):
    sub, args = git_split(seg)
    if sub is None:
        return None
    opts, pos = opts_pos(args, ("-m", "-F", "--message", "--file") if sub in ("commit", "tag", "stash", "merge") else ())
    if sub == "push":
        return ("push", push_shape(args))
    if sub == "reset" and long_is(opts, {"--hard", "--har", "--ha", "--merge", "--merg", "--mer", "--me", "--keep", "--kee", "--ke"}):
        block("git reset --hard/--merge/--keep discards work. Use `git restore --staged <path>` or ask the owner.")
    if sub in ("clean", "rebase", "filter-branch", "filter-repo", "update-ref", "symbolic-ref", "gc", "prune", "replace"):
        block(f"git {sub} is destructive or rewrites history; owner approval required.")
    if sub == "reflog" and pos and pos[0] in ("expire", "delete"):
        block("git reflog expire/delete is destructive.")
    if sub == "stash" and pos and pos[0] in ("drop", "clear"):
        block("git stash drop/clear destroys saved work.")
    if sub == "tag" and (cluster_has(opts, "df") or long_is(opts, {"--delete", "--force"})):
        block("deleting or moving tags is not allowed autonomously.")
    if sub == "remote" and pos and pos[0] in ("add", "set-url", "remove", "rm", "rename", "set-head", "prune"):
        block("changing remotes is not allowed autonomously.")
    if sub == "config" and not (long_is(opts, {"--get", "--get-all", "--get-regexp", "--list", "--show-origin", "--show-scope"}) or "-l" in opts):
        block("git config writes (hooks path, credential helper, url rewrites) are not allowed autonomously.")
    if sub == "commit" and (long_is(opts, {"--amend", "--no-verify"}) or any(o.startswith(("--ame", "--no-v")) for o in opts)
                            or cluster_has(opts, "n")):
        block("git commit --amend / --no-verify are not allowed (rewrites history or skips hooks).")
    if sub == "add" and (cluster_has(opts, "fA") or long_is(opts, {"--force", "--all"}) or any(o.startswith(("--for", "--al")) for o in opts)
                         or any(p in (".", ":/", "*", "./") for p in pos)):
        block("git add must name files; no -f/-A/. (could stage ignored secrets or generated files).")
    if sub == "branch" and (cluster_has(opts, "dDfmMcC") or any(o.startswith(("--delete", "--forc", "--move", "--copy")) for o in opts)):
        block("deleting, renaming, copying or force-moving branches is not allowed autonomously.")
    if sub == "switch" and (cluster_has(opts, "fC") or any(o.startswith(("--force", "--discard", "--orphan")) for o in opts)):
        block("git switch with force/discard/orphan/-C is not allowed.")
    if sub == "checkout":
        if cluster_has(opts, "fB") or any(o.startswith(("--force", "--orphan", "--ours", "--theirs")) for o in opts) or "." in pos:
            block("git checkout with force/-B/./--ours/--theirs overwrites work; use git switch.")
        if "--" in args:
            paths = args[args.index("--") + 1:]
            if paths != ["next-env.d.ts"]:
                block("`git checkout -- <paths>` discards changes; only next-env.d.ts may be restored this way.")
    if sub == "restore":
        staged_only = ("--staged" in opts or "-S" in opts) and not (cluster_has(opts, "W") or long_is(opts, {"--worktree"}))
        if not staged_only and pos != ["next-env.d.ts"]:
            block("git restore discards working-tree changes; only `--staged` or next-env.d.ts is allowed.")
    if sub == "fetch" and (any(":" in p or p.startswith("+") for p in pos) or cluster_has(opts, "f") or "--force" in opts):
        block("git fetch with refspecs/force can overwrite local branches.")
    return None


# ---------- gh ----------
def parse_gh_api(seg):
    method, fields, path, i = None, [], None, 2
    while i < len(seg):
        t = seg[i]
        if t == "--input" and i + 1 < len(seg) or t.startswith("--input="):
            val = seg[i + 1] if t == "--input" else t.split("=", 1)[1]
            fields.append("@input=@" + val); i += 2 if t == "--input" else 1; continue
        if t in ("--hostname", "-H", "--header") or t.startswith(("--hostname=", "--header=")):
            block("gh api --hostname/-H can redirect credentials or smuggle a method override.")
        if t in ("-X", "--method") and i + 1 < len(seg):
            method = seg[i + 1].upper(); i += 2; continue
        if t.startswith("--method="):
            method = t.split("=", 1)[1].upper(); i += 1; continue
        if re.fullmatch(r"-X[A-Za-z]+", t):
            method = t[2:].upper(); i += 1; continue
        if t in ("-f", "-F", "--field", "--raw-field") and i + 1 < len(seg):
            fields.append(seg[i + 1]); i += 2; continue
        if t.startswith(("--field=", "--raw-field=")):
            fields.append(t.split("=", 1)[1]); i += 1; continue
        if t in ("-q", "--jq") and i + 1 < len(seg):
            i += 2; continue
        if t in ("--paginate", "--slurp", "-i", "--include", "--silent"):
            i += 1; continue
        if t.startswith("-"):
            return None
        if path is None:
            path = t; i += 1; continue
        return None
    return method, fields, path


def safe_body_file(value):
    path = os.path.realpath(value[1:])
    return path.startswith(SAFE_FILE_ROOTS) and not SECRET_FILE_RE.search(path)


def check_gh(seg, single):
    if len(seg) < 2:
        return None
    if seg[1] in GH_BLOCKED_SUBS:
        block(f"`gh {seg[1]}` changes repo/account/security state; owner only.")
    if seg[1] != "api":
        return None
    parsed = parse_gh_api(seg)
    if parsed is None:
        return None
    method, fields, path = parsed
    if path is None:
        return None
    path = path.split("?", 1)[0].lstrip("/")
    effective = method or ("POST" if fields else "GET")
    if path == "graphql":
        block("gh api graphql is not used (blocked in this environment; REST only).")
    if not re.fullmatch(rf"repos/{re.escape(REPO)}(/.*)?", path) or ".." in path or "%" in path:
        if effective == "GET":
            return None
        block("gh api writes outside this repo are not allowed.")
    sub = path[len(f"repos/{REPO}"):].strip("/")
    keys = {}
    for f in fields:
        if f.startswith("@input=@"):
            # --input FILE: body comes from a non-secret JSON file under /tmp or /home/claude; judge its keys like -f fields
            if not (effective in ("POST", "PATCH") and method) or not safe_body_file(f[7:]):
                block("gh api --input needs an explicit -X POST/PATCH and a non-secret file under /tmp or /home/claude.")
            try:
                body = json.load(open(os.path.realpath(f[8:])))
            except Exception:
                return None
            if not isinstance(body, dict) or not all(isinstance(x, (str, bool)) for x in body.values()):
                return None
            keys.update({k: str(v) for k, v in body.items()})
            continue
        if "=" not in f:
            return None
        k, v = f.split("=", 1)
        keys[k] = v
        if v.startswith("@") and not (effective in ("POST", "PATCH") and safe_body_file(v)):
            block("gh api body files must be non-secret files under /tmp or /home/claude.")
    if effective == "GET":
        return ("allow", "read-only GitHub REST call on this repo") if single else None
    if effective == "PUT" and re.fullmatch(r"pulls/\d+/(merge|update-branch)", sub):
        return None  # falls to the ask rule: owner approval per PR
    if effective == "POST" and sub == "pulls":
        head = keys.get("head", "")
        head = head.split(":", 1)[1] if head.startswith(f"{REPO.split('/')[0]}:") else head
        if set(keys) <= {"title", "body", "head", "base", "draft", "maintainer_can_modify"} and {"title", "head", "base"} <= set(keys) \
                and BRANCH_RE.match(head) and keys["base"] == "main":
            return ("allow", "open a PR from a claude/* branch into main") if single else None
    elif effective == "PATCH" and re.fullmatch(r"pulls/\d+", sub) and keys and set(keys) <= {"title", "body"}:
        return ("allow", "update PR title/body") if single else None
    elif effective == "POST" and re.fullmatch(r"issues/\d+/comments", sub) and set(keys) == {"body"}:
        return ("allow", "comment on a PR/issue") if single else None
    block(f"gh api {effective} {sub or '/'} is not on the write allowlist (branch protection, rulesets, contents, refs, "
          "deployments, settings, deletes, ... need the owner).")


# ---------- other commands ----------
def check_rm(seg):
    opts, pos = opts_pos(seg[1:])
    recursive = cluster_has(opts, "rR") or long_is(opts, {"--recursive"})
    repo = os.path.realpath(os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd()))
    for p in pos:
        if re.search(r"[$*?\[]", p):
            if recursive:
                block("recursive rm with a glob/variable is not allowed.")
            continue
        real = os.path.realpath(os.path.expanduser(p))
        in_repo = real == repo or real.startswith(repo + os.sep)
        top = os.path.relpath(real, repo).split(os.sep)[0] if in_repo else None
        if top in (".git", ".claude") or SECRET_FILE_RE.search(real) or real == repo:
            block("rm of .git, .claude, secret files, or the repo root is not allowed.")
        if not in_repo and not real.startswith("/tmp/"):
            block("rm outside the repo and /tmp is not allowed.")
        if recursive and not (real.startswith("/tmp/") or top in RM_RECURSIVE_OK):
            block("recursive rm is limited to build dirs (.next, node_modules, out, build, dist) and /tmp.")


def check_misc(seg):
    cmd0 = seg[0]
    if cmd0 in ("vercel", "npx", "pnpm", "yarn", "bunx", "npm") and any(t == "vercel" or t.endswith("/vercel") for t in seg):
        block("the vercel CLI can deploy or change production config; owner only.")
    if cmd0 == "printenv" or (cmd0 == "env" and len(seg) == 1) or (cmd0 == "declare" and "-x" in seg) or (cmd0 == "export" and seg[1:] == ["-p"]):
        block("dumping the environment would expose tokens.")
    if cmd0 in READERS and any(SECRET_FILE_RE.search(a) for a in seg[1:]):
        block("reading or copying secret files (.env, keys, tokens, credentials) is not allowed.")
    if cmd0 in ("rm", "rmdir", "shred", "unlink"):
        check_rm(seg)
    if cmd0 == "find" and "-delete" in seg:
        block("find -delete is not allowed.")


def scan(cmd, depth=0):
    """Return (segments, nested) after running every block check; segments from nested shells/eval are included
    so git/gh checks apply to them too. None if unparseable."""
    segs = segments(cmd)
    if segs is None:
        return None
    out, nested = [], depth > 0
    for raw in segs:
        if raw[0] in ("env", "printenv") and len(raw) == 1:
            block("dumping the environment would expose tokens.")
        seg = normalize(raw)
        if not seg:
            continue
        inner = None
        if seg[0] in SHELLS and "-c" in seg and seg.index("-c") + 1 < len(seg):
            inner = seg[seg.index("-c") + 1]
        elif seg[0] == "eval":
            inner = " ".join(seg[1:])
        if inner is not None and depth < 3:
            sub = scan(inner, depth + 1)
            if sub:
                out.extend(sub[0])
            nested = True
        check_misc(seg)
        out.append(seg)
    return out, nested


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return passthrough()
    if data.get("tool_name") != "Bash":
        return passthrough()
    cmd = (data.get("tool_input") or {}).get("command", "").strip()
    if SECRET_VAR_RE.search(cmd):
        block("printing or passing token/secret environment variables is not allowed.")
    scanned = scan(cmd)
    if not scanned or not scanned[0]:
        return passthrough()
    segs, nested = scanned
    single = len(segs) == 1 and not nested and not any(x in cmd for x in ("`", "$(", "${", "\n"))
    verdict = None
    for seg in segs:
        if seg[0] == "git":
            r = check_git(seg)
            if r and r[0] == "push" and r[1] and single:
                verdict = ("allow", f"plain feature-branch push to {r[1]}")
        elif seg[0] == "gh":
            r = check_gh(seg, single)
            if r and r[0] == "allow":
                verdict = r
    if verdict:
        allow(verdict[1])
    return passthrough()


if __name__ == "__main__":
    main()
