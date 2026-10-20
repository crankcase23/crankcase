import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// The limiter and error_events regressions are SKIPPED on a tree that lacks the code they test (main, #89 alone). A skip reports as a pass, so
// on the integrated tree a renamed file or a changed import would silently switch every one of them off. CC_REQUIRE_INTEGRATED=1 turns "not
// present" into a failure; this proves the switch works, in whichever direction this tree needs: absent code must FAIL under it, present code must RUN.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const wired = (f) => fs.existsSync(path.join(ROOT, f)) && /from\s+["'][^"']*dbErrorLog(Safe)?["']/.test(fs.readFileSync(path.join(ROOT, f), "utf8"));
// NODE_TEST_CONTEXT makes a nested `node --test` believe it is a child reporter (silent output, exit 0), so it is removed.
const run = (file, env) => { const e = { ...process.env, ...env }; delete e.NODE_TEST_CONTEXT; return spawnSync("node", ["--test", path.join(ROOT, "scripts", "logging", "tests", file)], { encoding: "utf8", env: e }); };
const count = (out, k) => Number((new RegExp(`^# ${k} (\\d+)`, "m").exec(out) ?? [0, NaN])[1]);

test("CC_REQUIRE_INTEGRATED=1: limiter-logging fails when the limiter code is absent and runs every test when it is present", () => {
  const present = fs.existsSync(path.join(ROOT, "src/lib/authGuard.ts")) && fs.existsSync(path.join(ROOT, "src/lib/limiterDb.ts"));
  const r = run("limiter-logging.test.mjs", { CC_REQUIRE_INTEGRATED: "1" });
  if (present) { assert.equal(count(r.stdout, "skipped"), 0, `nothing may be skipped on the integrated tree:\n${r.stdout.slice(-600)}`); assert.ok(count(r.stdout, "pass") >= 12); }
  else assert.notEqual(r.status, 0, "absent limiter code must be a failure under CC_REQUIRE_INTEGRATED=1");
});

test("CC_REQUIRE_INTEGRATED=1: error-events-tls fails when errors.ts / events.ts are not wired and runs every test when they are", () => {
  const isWired = wired("src/lib/errors.ts") && wired("src/lib/events.ts");
  const r = run("error-events-tls.test.mjs", { CC_REQUIRE_INTEGRATED: "1" });
  if (isWired) { assert.equal(count(r.stdout, "skipped"), 0); assert.equal(count(r.stdout, "pass"), 4); }
  else assert.notEqual(r.status, 0, "an unwired recorder must be a failure under CC_REQUIRE_INTEGRATED=1");
});

test("without CC_REQUIRE_INTEGRATED the same files skip quietly where the code is absent (main and #89 alone keep passing)", () => {
  const r = run("error-events-tls.test.mjs", { CC_REQUIRE_INTEGRATED: "" });
  assert.equal(r.status, 0, r.stdout.slice(-400));
});
