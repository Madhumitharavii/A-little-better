import { useMemo, useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import type { WishItem } from '@/db/schema';
import { bulkCreateLifeItems } from '@/db/repositories/lifeRepository';
import { getLocalDateKey } from '@/db/dateUtils';
import { newVisionLines, parseVisionList } from './visionList';

interface VisionPasteModalProps {
  existing: WishItem[];
  onClose: () => void;
  onAdded: (count: number) => void;
}

/** Paste a whole vision board at once — one goal per line. */
export default function VisionPasteModal({ existing, onClose, onAdded }: VisionPasteModalProps) {
  const [text, setText] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [busy, setBusy] = useState(false);

  const y = Number(year) || new Date().getFullYear();
  const lines = useMemo(() => parseVisionList(text), [text]);
  const fresh = useMemo(() => newVisionLines(lines, existing, y), [lines, existing, y]);
  const skipped = lines.length - fresh.length;
  const achieved = fresh.filter((l) => l.done).length;

  const add = async () => {
    setBusy(true);
    const today = getLocalDateKey();
    const count = await bulkCreateLifeItems(
      fresh.map((l) => ({
        type: 'wish' as const,
        listType: 'annualVision' as const,
        title: l.title,
        category: l.category,
        year: y,
        done: l.done || undefined,
        dateCompleted: l.done ? today : undefined,
      })),
    );
    onAdded(count);
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="🎯" title="Add several goals" onClose={onClose} />
      <div className="space-y-3 text-xs">
        <p className="text-sand-800/70 leading-relaxed">
          One goal per line. Optional: a line ending in <strong>:</strong> becomes a category for the goals under it, and
          starting a line with <strong>✓</strong> marks it as already achieved.
        </p>
        <textarea
          aria-label="Goals, one per line"
          rows={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Learning:\nRead 12 books\nLearn to bake bread\n\nAdventures:\nSee the sea\n✓ Plant a herb garden'}
          className="w-full p-3 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none font-mono text-[12px] leading-relaxed"
        />
        <div className="flex items-center gap-2">
          <label className="font-semibold text-sand-900" htmlFor="vision-year">
            Year
          </label>
          <input
            id="vision-year"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-24 p-2 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 focus:outline-none"
          />
          <p className="text-sand-800/60 ml-auto text-right">
            {fresh.length} goal{fresh.length === 1 ? '' : 's'}
            {achieved ? ` (${achieved} achieved)` : ''}
            {skipped > 0 ? ` · ${skipped} already on your board` : ''}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={add}
            disabled={busy || fresh.length === 0}
            className="flex-1 py-3 bg-terracotta-400 hover:bg-terracotta-600 disabled:opacity-50 text-white font-semibold rounded-2xl"
          >
            {busy ? 'Adding…' : `Add ${fresh.length} goal${fresh.length === 1 ? '' : 's'}`}
          </button>
          <button onClick={onClose} className="flex-1 sm:flex-none px-5 py-3 bg-sand-100 hover:bg-sand-200 text-sand-900 font-semibold rounded-2xl">
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
