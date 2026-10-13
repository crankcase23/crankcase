// A small pool of OCR engine workers with priorities. Pure scheduling: no DOM, no engine import, so it is tested with fakes.
//
// Why it exists: reading one photo is dozens of independent engine calls (page passes, one call per glyph tile). One worker does
// them one after another; with more workers they overlap, and a lower `priority` number always runs first, so the cheap passes
// that settle a clean label go before the slow ones. Results never depend on which worker ran what: callers tally answers in
// their own fixed order.

export type PoolWorker = {
  setParameters(params: Record<string, unknown>): Promise<unknown>;
  recognize(image: unknown, options?: Record<string, unknown>, output?: Record<string, unknown>): Promise<{ data: { text: string; confidence: number } & Record<string, unknown> }>;
  terminate(): Promise<unknown>;
};

export class PoolCancelled extends Error {
  constructor() {
    super("scan finished");
    this.name = "PoolCancelled";
  }
}

type Slot = { worker: PoolWorker; psm: string | number | null; busy: boolean };
type Task<T> = { priority: number; seq: number; psm: string | number; run: (w: PoolWorker) => Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void };

export class OcrPool {
  private slots: Slot[] = [];
  private queue: Task<unknown>[] = [];
  private seq = 0;
  private cancelled = false;

  /** Adds an engine worker; queued work starts on it straight away. */
  add(worker: PoolWorker, psm: string | number | null = null): void {
    if (this.cancelled) {
      void worker.terminate().catch(() => undefined);
      return;
    }
    this.slots.push({ worker, psm, busy: false });
    this.pump();
  }

  get size(): number {
    return this.slots.length;
  }

  /** Queues one engine call. Lower `priority` runs first; equal priorities run in the order submitted. `psm` is set on the worker only when it differs from the last call. */
  submit<T>(priority: number, psm: string | number, run: (w: PoolWorker) => Promise<T>): Promise<T> {
    if (this.cancelled) return Promise.reject(new PoolCancelled());
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ priority, seq: this.seq++, psm, run, resolve, reject } as Task<unknown>);
      this.pump();
    });
  }

  /** Drops everything still waiting and stops accepting work. Calls already running finish on their own (or die with the worker). */
  cancel(): void {
    this.cancelled = true;
    const waiting = this.queue.splice(0);
    for (const t of waiting) t.reject(new PoolCancelled());
  }

  async terminateAll(): Promise<void> {
    this.cancel();
    await Promise.all(this.slots.map((s) => s.worker.terminate().catch(() => undefined)));
    this.slots = [];
  }

  private pump(): void {
    for (const slot of this.slots) {
      if (slot.busy || !this.queue.length) continue;
      let best = 0;
      for (let i = 1; i < this.queue.length; i++) {
        const a = this.queue[i], b = this.queue[best];
        if (a.priority < b.priority || (a.priority === b.priority && a.seq < b.seq)) best = i;
      }
      const task = this.queue.splice(best, 1)[0];
      slot.busy = true;
      void (async () => {
        try {
          if (slot.psm !== task.psm) {
            await slot.worker.setParameters({ tessedit_pageseg_mode: task.psm });
            slot.psm = task.psm;
          }
          task.resolve(await task.run(slot.worker));
        } catch (e) {
          task.reject(e);
        } finally {
          slot.busy = false;
          this.pump();
        }
      })();
    }
  }
}

/**
 * How many engine workers to use: one per spare core, at most three (each holds the language model in memory), at least one.
 * `cores` is navigator.hardwareConcurrency, which can be missing or absurd; an unknown count is treated as two cores.
 */
export function poolSizeFor(cores: number | undefined): number {
  const n = typeof cores === "number" && Number.isFinite(cores) && cores >= 1 ? Math.floor(cores) : 2;
  return Math.max(1, Math.min(3, n - 1));
}
