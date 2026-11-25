import { useState } from 'react';
import type { PromiseRow } from './promises';

const shortDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

/** "Promises kept: 3 of 4" — picks you said yes to, and whether you've started them. */
export default function PromiseTracker({ rows, verb }: { rows: PromiseRow[]; verb: 'watch' | 'read' }) {
  const [open, setOpen] = useState(false);
  if (!rows.length) return null;
  const kept = rows.filter((r) => r.state === 'kept').length;
  return (
    <div className="bg-sand-50 rounded-2xl p-3 text-left">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-sand-900">
          🤝 Promises kept: {kept} of {rows.length}
        </span>
        <span className={`text-sand-800/50 text-xs transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5 max-h-52 overflow-y-auto">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-2 text-[11px]">
              <span className="min-w-0">
                <span className="block text-sand-900 font-medium truncate">{r.title}</span>
                <span className="block text-sand-800/50">Picked {shortDate(r.pickedOn)}</span>
              </span>
              <span
                className={`shrink-0 px-2 py-0.5 rounded-full ${r.state === 'kept' ? 'bg-sage-100 text-sage-700' : 'bg-sand-100 text-sand-800/70'}`}
              >
                {r.state === 'kept' ? `✓ ${verb === 'watch' ? 'watched' : 'started'}` : 'not yet'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
