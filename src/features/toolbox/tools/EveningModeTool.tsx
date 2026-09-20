import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import type { CareEntry } from '@/db/schema';

interface EveningNotes {
  goodThing: string;
  leaveTomorrow: string;
  mood: string;
}

interface EveningModeToolProps {
  todaysCare: CareEntry[];
  initialNotes: EveningNotes;
  onClose: () => void;
  onSave: (notes: EveningNotes) => void;
}

const MOODS = ['😊', '🙂', '😐', '😕', '😔'];

function isDone(entries: CareEntry[], itemKey: string): boolean {
  return entries.some((e) => e.itemKey === itemKey && e.status === 'done');
}

export default function EveningModeTool({ todaysCare, initialNotes, onClose, onSave }: EveningModeToolProps) {
  const [goodThing, setGoodThing] = useState(initialNotes.goodThing);
  const [leaveTomorrow, setLeaveTomorrow] = useState(initialNotes.leaveTomorrow);
  const [mood, setMood] = useState(initialNotes.mood);

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="🌙" title="Before I Call It a Day" onClose={onClose} />

      <div className="bg-sand-50 p-4 rounded-2xl border border-sand-200 space-y-2 text-xs">
        <p className="font-semibold text-sand-900">Today's Care Summary:</p>
        <div className="grid grid-cols-2 gap-2 text-sand-800">
          <p>• Bath / Shower: {isDone(todaysCare, 'bathed') ? '✓' : '◯'}</p>
          <p>• Fresh Fruit: {isDone(todaysCare, 'ateFruit') ? '✓' : '◯'}</p>
          <p>• Room Reset: {isDone(todaysCare, 'spaceReset') ? '✓' : '◯'}</p>
          <p>• Message Reset: {isDone(todaysCare, 'messageReset') ? '✓' : '◯'}</p>
        </div>
      </div>

      <div className="space-y-4 text-xs">
        <div>
          <label className="block font-semibold text-sand-900 mb-1">One good thing about today</label>
          <input
            type="text"
            value={goodThing}
            onChange={(e) => setGoodThing(e.target.value)}
            placeholder="A warm drink, a smile, finishing a task..."
            className="w-full p-3 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none focus:border-slate-500"
          />
        </div>

        <div>
          <label className="block font-semibold text-sand-900 mb-1">One thing I want to leave for tomorrow</label>
          <input
            type="text"
            value={leaveTomorrow}
            onChange={(e) => setLeaveTomorrow(e.target.value)}
            placeholder="Leave this off your mind for tonight..."
            className="w-full p-3 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none focus:border-slate-500"
          />
        </div>

        <div>
          <label className="block font-semibold text-sand-900 mb-2">How do I feel right now?</label>
          <div className="flex justify-between max-w-xs mx-auto">
            {MOODS.map((m) => (
              <button
                key={m}
                onClick={() => setMood(m)}
                className={`w-11 h-11 text-xl rounded-2xl border transition-all ${
                  mood === m ? 'bg-slate-800 text-white border-slate-800 scale-110' : 'bg-sand-50 border-sand-200 hover:bg-sand-100'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-2 text-center">
        <button
          onClick={() => onSave({ goodThing, leaveTomorrow, mood })}
          className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-2xl transition-colors shadow-sm"
        >
          That's enough for today. 🌙
        </button>
      </div>
    </Modal>
  );
}
