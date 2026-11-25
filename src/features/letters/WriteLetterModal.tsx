import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import { getLocalDateKey, addDays } from '@/db/dateUtils';
import { sealLetter } from '@/db/repositories/letterRepository';
import { longDate, quickDates, untilText } from './letters';

interface Props {
  onClose: () => void;
  onSealed: (openOn: string) => void;
}

export default function WriteLetterModal({ onClose, onSealed }: Props) {
  const today = getLocalDateKey();
  const tomorrow = addDays(today, 1);
  const quick = quickDates(today);
  const [body, setBody] = useState('');
  const [openOn, setOpenOn] = useState(quick[2].date);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const valid = body.trim().length > 0 && openOn >= tomorrow;

  const seal = async () => {
    setSaving(true);
    await sealLetter(body.trim(), openOn);
    onSealed(openOn);
  };

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-lg">
      <ModalHeader icon="✉️" title="A letter to future me" onClose={onClose} />

      {confirming ? (
        <div className="space-y-4 text-center">
          <span className="text-5xl block">🔒</span>
          <p className="text-sm text-sand-900">
            Seal it until <b>{longDate(openOn)}</b> ({untilText(today, openOn)})?
          </p>
          <p className="text-xs text-sand-800/70 bg-sand-50 rounded-2xl p-3">
            Once it’s sealed you can’t read or change it before then — not even a peek. On that day it opens by itself and the app tells you.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setConfirming(false)} className="flex-1 py-3 bg-sand-100 hover:bg-sand-200 text-sand-900 text-sm font-semibold rounded-2xl">
              Keep writing
            </button>
            <button
              onClick={seal}
              disabled={saving}
              className="flex-1 py-3 bg-terracotta-400 hover:bg-terracotta-600 disabled:opacity-50 text-white text-sm font-semibold rounded-2xl"
            >
              Seal it
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <textarea
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={9}
            placeholder="Dear future me…"
            className="w-full p-4 bg-sand-50 border border-sand-200 rounded-2xl serif text-[15px] leading-relaxed text-sand-900 focus:outline-none focus:border-sand-300 resize-y"
          />
          <div className="space-y-2">
            <p className="text-xs font-semibold text-sand-900">Opens on</p>
            <div className="flex flex-wrap gap-1.5">
              {quick.map((q) => (
                <button
                  key={q.label}
                  onClick={() => setOpenOn(q.date)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                    openOn === q.date ? 'bg-sage-500 text-white border-sage-500' : 'bg-white text-sand-800 border-sand-200'
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-sand-800/80">
              <span>or pick a day:</span>
              <input
                type="date"
                aria-label="Day the letter opens"
                min={tomorrow}
                value={openOn}
                onChange={(e) => e.target.value && setOpenOn(e.target.value)}
                className="text-xs p-1.5 bg-white border border-sand-200 rounded-lg"
              />
            </div>
            <p className="text-[11px] text-sand-800/60">
              {openOn >= tomorrow ? `Opens ${longDate(openOn)} — ${untilText(today, openOn)}.` : 'Pick a day after today.'}
            </p>
          </div>
          <button
            onClick={() => setConfirming(true)}
            disabled={!valid}
            className="w-full py-3 bg-terracotta-400 hover:bg-terracotta-600 disabled:opacity-40 text-white text-sm font-semibold rounded-2xl shadow-sm"
          >
            Seal the letter
          </button>
        </div>
      )}
    </Modal>
  );
}
