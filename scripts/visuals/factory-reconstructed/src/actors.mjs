// RECONSTRUCTED-V1 | NOT the lost original.
// ACTOR / GENERATOR ABSTRACTION. The original adapters are LOST (UNKNOWN). Source for the contract: VD arch §0 ("actors propose, code
// decides"; actors enum), §1.3 (what a generator must hand over: file, attestation, request id, prompt; "The code fills [hashes/dims] in").
// A generator adapter returns the generator's CLAIMS plus the raw bytes. It never writes factory objects or states.
import fs from "node:fs";
import path from "node:path";

export class ActorUnavailable extends Error { constructor(msg) { super(msg); this.code = "ACTOR_UNAVAILABLE"; } }

/** Interface: async generate({cycle, prompt, vcRef, deltaRef, deltaItems}) -> {bytes, mediaType, generator, requestId, generationId, attestation, imageInputs, inputHashes, contractAck, licenseTerms, deltaRef?, deltaAddressed?} */
export class UnavailableGenerator {
  constructor(reason) { this.reason = reason; this.system = "unavailable"; }
  async generate() { throw new ActorUnavailable(this.reason); }
}

/** Reads a candidate a HUMAN/OTHER SYSTEM dropped in a folder: candidate.png + candidate.claims.json. Does not invent claims. */
export class FileDropGenerator {
  constructor(dropDir) { this.dropDir = dropDir; }
  async generate(req) {
    const png = path.join(this.dropDir, "candidate.png"), claims = path.join(this.dropDir, "candidate.claims.json");
    if (!fs.existsSync(png) || !fs.existsSync(claims)) throw new ActorUnavailable(`no candidate.png + candidate.claims.json in ${this.dropDir}`);
    return { ...JSON.parse(fs.readFileSync(claims, "utf8")), bytes: fs.readFileSync(png), mediaType: "png", deltaRef: req.deltaRef ?? undefined };
  }
}

/** Test double (SYNTHETIC). Each queue item is an output object or a function(req) returning one. */
export class ScriptedGenerator {
  constructor(queue) { this.queue = [...queue]; this.calls = []; }
  async generate(req) {
    this.calls.push(req);
    const next = this.queue.shift();
    if (!next) throw new ActorUnavailable("scripted generator exhausted");
    const out = typeof next === "function" ? next(req) : next;
    return { ...out, deltaRef: req.deltaRef ?? undefined };
  }
}

/** Convenience: request -> adapter -> submit. */
export async function runGeneration(run, adapter, { promptText = null } = {}) {
  const req = run.requestGeneration({ promptText });
  const out = await adapter.generate(req);
  return run.submitGeneration(out, { promptText: req.prompt });
}
