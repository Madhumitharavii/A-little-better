import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import DateField from '@/shared/components/DateField';
import ConfirmInline from '@/shared/components/ConfirmInline';
import { logStudySession } from '@/db/repositories/studyRepository';
import { getLocalDateKey } from '@/db/dateUtils';
import type { SubjectItem } from '@/db/schema';

interface StudySessionModalProps {
  subjects: SubjectItem[];
  /** 'timer' = saving a session the timer just measured; 'manual' = adding one by hand. */
  mode: 'timer' | 'manual';
  initialSubjectId?: string;
  initialTopicId?: string;
  initialMinutes?: number;
  initialDate?: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}

const QUICK_MINUTES = [15, 30, 45, 60, 90];

export default function StudySessionModal({
  subjects,
  mode,
  initialSubjectId,
  initialTopicId,
  initialMinutes,
  initialDate,
  onClose,
  onSaved,
}: StudySessionModalProps) {
  const [subjectId, setSubjectId] = useState(initialSubjectId ?? subjects[0]?.id ?? '');
  const [topicId, setTopicId] = useState<string | undefined>(initialTopicId);
  const [minutes, setMinutes] = useState(String(initialMinutes ?? 30));
  const [date, setDate] = useState(initialDate ?? getLocalDateKey());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // A timed session is real study — closing by accident shouldn't lose it.
  const requestClose = () => (mode === 'timer' ? setConfirmDiscard(true) : onClose());

  const subject = subjects.find((s) => s.id === subjectId);
  const mins = Math.round(Number(minutes));
  const valid = !!subject && Number.isFinite(mins) && mins > 0 && mins <= 24 * 60 && !!date;
  const long = mins > 6 * 60;

  const save = async () => {
    if (!subject || !valid) return;
    setSaving(true);
    await logStudySession({ subject, topicId, minutes: mins, date, note });
    const topic = subject.topics.find((t) => t.id === topicId);
    onSaved(`${mins} min of ${topic ? topic.name : subject.title} saved 📚`);
  };

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
      active ? 'bg-slate-800 text-white border-slate-800' : 'bg-sand-50 border-sand-200 text-sand-800 hover:bg-sand-100'
    }`;

  return (
    <Modal onClose={requestClose}>
      <ModalHeader icon={mode === 'timer' ? '⏱️' : '📚'} title={mode === 'timer' ? 'Nice work — save this session' : 'Add a study session'} onClose={requestClose} />

      <div className="space-y-2">
        <p className="text-xs font-semibold text-sand-900">Subject</p>
        <div className="flex flex-wrap gap-2">
          {subjects.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSubjectId(s.id);
                setTopicId(undefined);
              }}
              aria-pressed={s.id === subjectId}
              className={chip(s.id === subjectId)}
            >
              {s.icon ? `${s.icon} ` : ''}
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {subject && subject.topics.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-sand-900">
            Topic <span className="font-normal text-sand-800/60">(optional)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {subject.topics.map((t) => (
              <button key={t.id} onClick={() => setTopicId(t.id === topicId ? undefined : t.id)} aria-pressed={t.id === topicId} className={chip(t.id === topicId)}>
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-xs font-semibold text-sand-900" htmlFor="study-minutes">
          How long (minutes)
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="study-minutes"
            type="number"
            inputMode="numeric"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="w-24 p-2 bg-white border border-sand-200 rounded-xl text-sm text-sand-900 focus:outline-none"
          />
          {mode === 'manual' &&
            QUICK_MINUTES.map((m) => (
              <button key={m} onClick={() => setMinutes(String(m))} className={chip(Number(minutes) === m)}>
                {m}
              </button>
            ))}
        </div>
        {long && <p className="text-[11px] text-sand-800/70">That's over 6 hours — if the timer was left running, adjust the minutes before saving.</p>}
      </div>

      {mode === 'manual' && <DateField label="Date" value={date} onChange={setDate} />}

      <div className="space-y-2">
        <label className="block text-xs font-semibold text-sand-900" htmlFor="study-note">
          Note <span className="font-normal text-sand-800/60">(optional)</span>
        </label>
        <textarea
          id="study-note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What did you cover? Anything that clicked, or felt tricky?"
          className="w-full p-3 bg-sand-50/50 border border-sand-200 rounded-2xl text-xs text-sand-900 focus:outline-none resize-none"
        />
      </div>

      <button
        onClick={save}
        disabled={!valid || saving}
        className="w-full py-2.5 bg-terracotta-400 hover:bg-terracotta-600 disabled:opacity-50 text-white text-xs font-semibold rounded-2xl transition-colors"
      >
        {saving ? 'Saving…' : 'Save session'}
      </button>

      {confirmDiscard && (
        <ConfirmInline
          title="Discard this session?"
          description={`The ${Number.isFinite(mins) ? mins : ''} minutes you just studied won't be saved.`}
          confirmLabel="Discard"
          onConfirm={onClose}
          onCancel={() => setConfirmDiscard(false)}
        />
      )}
    </Modal>
  );
}
