/**
 * Main-thread client for the on-device embedding model (see
 * embedding.worker.ts). Starts the worker on first use, and exposes the
 * model's status so the UI can show "loading", "ready" or an error.
 */
export type ModelStatus =
  | { state: 'off' }
  | { state: 'loading'; progress: number }
  | { state: 'ready' }
  | { state: 'error'; message: string };

let worker: Worker | null = null;
let status: ModelStatus = { state: 'off' };
let nextId = 1;
const pending = new Map<number, { resolve: (v: number[][]) => void; reject: (e: Error) => void }>();
const listeners = new Set<(s: ModelStatus) => void>();

function setStatus(next: ModelStatus) {
  status = next;
  for (const l of listeners) l(status);
}

export function subscribeModelStatus(listener: (s: ModelStatus) => void): () => void {
  listeners.add(listener);
  listener(status);
  return () => {
    listeners.delete(listener);
  };
}

export function getModelStatus(): ModelStatus {
  return status;
}

/**
 * If the model hasn't started within this long, give up (the worker may
 * have run out of memory or hit something the browser can't do) — rather
 * than showing "Loading… 100%" forever and leaving everything waiting.
 */
const START_TIMEOUT_MS = 90_000;
let startTimer: number | undefined;
const clearStartTimer = () => {
  window.clearTimeout(startTimer);
  startTimer = undefined;
};

/** Stops a worker that failed and tells everyone waiting on it. */
function failWorker(message: string) {
  clearStartTimer();
  worker?.terminate();
  worker = null;
  for (const p of pending.values()) p.reject(new Error(message));
  pending.clear();
  setStatus({ state: 'error', message });
}

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./embedding.worker.ts', import.meta.url), { type: 'module' });
  clearStartTimer();
  startTimer = window.setTimeout(
    () => failWorker("The model couldn't start on this device. Turn on-device AI off and on to try again."),
    START_TIMEOUT_MS,
  );
  // A worker that crashes (e.g. out of memory) sends no message — catch that too.
  worker.onerror = (e) => {
    e.preventDefault();
    failWorker("The model stopped unexpectedly. Turn on-device AI off and on to try again.");
  };
  worker.onmessage = (event: MessageEvent) => {
    const msg = event.data;
    if (msg.type === 'progress') setStatus({ state: 'loading', progress: Math.round(msg.progress) });
    else if (msg.type === 'ready') {
      clearStartTimer();
      setStatus({ state: 'ready' });
    } else if (msg.type === 'embedded') {
      clearStartTimer();
      if (status.state !== 'ready') setStatus({ state: 'ready' });
      pending.get(msg.id)?.resolve(msg.vectors);
      pending.delete(msg.id);
    } else if (msg.type === 'error') {
      setStatus({ state: 'error', message: msg.message });
      if (msg.id !== undefined) {
        pending.get(msg.id)?.reject(new Error(msg.message));
        pending.delete(msg.id);
      }
    }
  };
  return worker;
}

/** Loads the model (from the app itself) without embedding anything yet. */
export function warmUpModel(): void {
  if (status.state === 'ready' || status.state === 'loading' || status.state === 'error') return;
  setStatus({ state: 'loading', progress: 0 });
  ensureWorker().postMessage({ type: 'load' });
}

/** Embeds texts into 384-dimension unit vectors. Batches are processed in order. */
export function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return Promise.resolve([]);
  // After a failure, don't keep restarting it in the background — switching AI off and on retries.
  if (status.state === 'error') return Promise.reject(new Error(status.message));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    if (status.state === 'off') setStatus({ state: 'loading', progress: 0 });
    ensureWorker().postMessage({ type: 'embed', id, texts });
  });
}

/** Stops the model and frees its memory (e.g. when on-device AI is switched off). */
export function shutDownModel(): void {
  clearStartTimer();
  worker?.terminate();
  worker = null;
  for (const p of pending.values()) p.reject(new Error('On-device AI was switched off.'));
  pending.clear();
  setStatus({ state: 'off' });
}
