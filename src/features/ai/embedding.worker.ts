/// <reference lib="webworker" />
/**
 * Runs the sentence-embedding model (all-MiniLM-L6-v2, quantized ONNX)
 * off the main thread, so the app never freezes while it thinks.
 *
 * Fully local: the model is loaded from the app's own /models folder and
 * the ONNX Runtime engine from /ort — never from Hugging Face or a CDN —
 * and the text being embedded never leaves this device.
 */
import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = '/models/';
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.wasmPaths = '/ort/';
  // One thread is plenty for short texts and avoids needing cross-origin isolation.
  env.backends.onnx.wasm.numThreads = 1;
}

export const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

type InMessage = { type: 'load' } | { type: 'embed'; id: number; texts: string[] };

let extractor: Promise<FeatureExtractionPipeline> | null = null;

function load(): Promise<FeatureExtractionPipeline> {
  if (!extractor) {
    extractor = pipeline('feature-extraction', MODEL_ID, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (p: { status?: string; progress?: number; file?: string }) => {
        if (p.status === 'progress' && typeof p.progress === 'number') {
          self.postMessage({ type: 'progress', file: p.file, progress: p.progress });
        }
      },
    }) as Promise<FeatureExtractionPipeline>;
  }
  return extractor;
}

self.onmessage = async (event: MessageEvent<InMessage>) => {
  const msg = event.data;
  try {
    const model = await load();
    if (msg.type === 'load') {
      self.postMessage({ type: 'ready' });
      return;
    }
    // Mean-pooled, L2-normalised sentence embeddings (384 numbers each).
    const output = await model(msg.texts, { pooling: 'mean', normalize: true });
    const [n, dims] = output.dims as [number, number];
    const data = output.data as Float32Array;
    const vectors: number[][] = [];
    for (let i = 0; i < n; i++) vectors.push(Array.from(data.subarray(i * dims, (i + 1) * dims)));
    self.postMessage({ type: 'embedded', id: msg.id, vectors });
  } catch (err) {
    extractor = null;
    self.postMessage({ type: 'error', id: 'id' in msg ? msg.id : undefined, message: err instanceof Error ? err.message : String(err) });
  }
};
