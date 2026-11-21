import { setAiEnabled, useAiEnabled, useAiState, useModelStatus } from './aiEngine';

/** Settings card: switch on-device AI on or off, and see what it's doing. */
export default function OnDeviceAiSection() {
  const enabled = useAiEnabled();
  const model = useModelStatus();
  const ai = useAiState();

  let statusText = '';
  if (enabled) {
    if (model.state === 'error') statusText = `Couldn't start the model: ${model.message}`;
    else if (model.state === 'loading') statusText = model.progress > 0 ? `Loading the model… ${model.progress}%` : 'Loading the model…';
    else if (ai.indexing) statusText = `Reading your entries… ${ai.indexing.done} of ${ai.indexing.total}`;
    else if (ai.ready) statusText = `Ready — understands ${ai.docCount} piece${ai.docCount === 1 ? '' : 's'} of writing.`;
    else statusText = 'Starting…';
  }

  return (
    <div className="p-3 bg-slate-100/70 rounded-2xl border border-slate-500/20 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-sand-900 text-xs">🧠 On-device AI</p>
          <p className="text-[11px] text-sand-800/60 mt-0.5">
            Search your writing by meaning, see your journal themes, and let Noticed for You understand how you've been feeling. A small
            language model (about 45 MB, downloaded once from this app) runs entirely on this device — your writing never leaves it.
          </p>
        </div>
        <button
          onClick={() => setAiEnabled(!enabled)}
          aria-pressed={enabled}
          className={`px-3 py-2 rounded-xl font-semibold text-xs shrink-0 transition-colors ${enabled ? 'bg-sage-500 text-white' : 'bg-sand-200 text-sand-800'}`}
        >
          {enabled ? 'On' : 'Off'}
        </button>
      </div>
      {statusText && <p className={`text-[11px] ${model.state === 'error' ? 'text-terracotta-600' : 'text-sand-800/70'}`}>{statusText}</p>}
    </div>
  );
}
