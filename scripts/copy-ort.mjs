// Copies the ONNX Runtime WebAssembly engine (used by Transformers.js to run
// the on-device AI model) from node_modules into public/ort/, so the app
// serves it itself instead of fetching it from a CDN. Runs automatically
// before `npm run dev` and `npm run build` (see package.json). The copied
// file is gitignored — it always comes from the installed package version.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = 'ort-wasm-simd-threaded.jsep.wasm';
const from = join(root, 'node_modules', '@huggingface', 'transformers', 'dist', file);
const toDir = join(root, 'public', 'ort');

if (!existsSync(from)) {
  console.warn(`[copy-ort] ${file} not found — run npm install first. On-device AI will be unavailable.`);
  process.exit(0);
}
mkdirSync(toDir, { recursive: true });
copyFileSync(from, join(toDir, file));
console.log(`[copy-ort] ${file} → public/ort/`);
