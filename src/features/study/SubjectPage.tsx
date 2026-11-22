import { useState } from 'react';
import type { StudyTopic, SubjectItem, TopicStatus } from '@/db/schema';
import {
  addTopic,
  moveTopic,
  removeStudySession,
  removeSubject,
  removeTopic,
  updateSubject,
  updateTopic,
} from '@/db/repositories/studyRepository';
import ConfirmInline from '@/shared/components/ConfirmInline';
import DateField from '@/shared/components/DateField';
import { formatDisplayDate } from '@/shared/utils/formatDate';
import { useStudySessions, useSubjects, sessionsWithin, totalMinutes, formatMinutes, sessionsThisWeek } from './useStudy';
import { startStudyTimer, useStudyTimer } from './studyTimer';
import StudySessionModal from './StudySessionModal';
import WeeklyGoalSection from './WeeklyGoalSection';

const STATUS: Record<TopicStatus, { label: string; style: string; next: TopicStatus }> = {
  notStarted: { label: '○ Not started', style: 'bg-sand-50 border-sand-200 text-sand-800/70', next: 'learning' },
  learning: { label: '🌱 Learning', style: 'bg-sage-100 border-sage-300 text-sage-700', next: 'confident' },
  confident: { label: '✅ Confident', style: 'bg-sage-500 border-sage-500 text-white', next: 'notStarted' },
};

interface SubjectPageProps {
  subjectId: string;
  onBack: () => void;
  showToast: (msg: string) => void;
}

/** One subject: its goal, topics (tap a status to change it), time studied, and every session. */
export default function SubjectPage({ subjectId, onBack, showToast }: SubjectPageProps) {
  const subjects = useSubjects();
  const allSessions = useStudySessions();
  const { timer } = useStudyTimer();
  const [newTopic, setNewTopic] = useState('');
  const [editingDetails, setEditingDetails] = useState(false);
  const [logging, setLogging] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  if (!subjects) return null;
  const subject = subjects.find((s) => s.id === subjectId);
  if (!subject) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-xs font-semibold text-sand-800/70">
          ← Week
        </button>
        <p className="text-xs text-sand-800/60">This subject was removed.</p>
      </div>
    );
  }

  const sessions = allSessions.filter((s) => s.subjectId === subject.id);
  const topicName = (id?: string) => subject.topics.find((t) => t.id === id)?.name;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-xs font-semibold text-sand-800/70 hover:text-sand-900">
        ← Week
      </button>

      <section className="bg-slate-100/70 p-5 sm:p-6 rounded-3xl border border-slate-500/20 shadow-sm space-y-4">
        {editingDetails ? (
          <DetailsEditor subject={subject} onDone={() => setEditingDetails(false)} />
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="serif text-2xl font-semibold text-sand-900">
                {subject.icon ? `${subject.icon} ` : ''}
                {subject.title}
              </h2>
              <p className="text-xs text-sand-800/60">
                {subject.goal ? `Goal: ${subject.goal}` : 'No goal set'}
                {subject.goalDate ? ` · by ${formatDisplayDate(subject.goalDate)}` : ''}
              </p>
            </div>
            <button onClick={() => setEditingDetails(true)} className="px-2.5 py-1.5 bg-sand-100 hover:bg-sand-200 text-sand-800 rounded-lg font-semibold text-[11px] shrink-0">
              Edit
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ['This week', formatMinutes(totalMinutes(sessionsThisWeek(sessions)))],
            ['This month', formatMinutes(totalMinutes(sessionsWithin(sessions, 30)))],
            ['All time', formatMinutes(totalMinutes(sessions))],
          ].map(([label, value]) => (
            <div key={label} className="p-2.5 bg-sand-50 border border-sand-200 rounded-2xl">
              <p className="text-sm font-semibold text-sand-900">{value}</p>
              <p className="text-[10px] text-sand-800/60">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              if (timer) {
                showToast('A study timer is already running — stop it on the Week page first.');
                return;
              }
              startStudyTimer(subject.id);
              onBack();
            }}
            className="flex-1 py-2.5 bg-terracotta-400 hover:bg-terracotta-600 text-white text-xs font-semibold rounded-2xl"
          >
            ▶ Start timer
          </button>
          <button onClick={() => setLogging(true)} className="flex-1 py-2.5 bg-sand-100 hover:bg-sand-200 text-sand-900 text-xs font-semibold rounded-2xl">
            + Add by hand
          </button>
        </div>
      </section>

      <WeeklyGoalSection subject={subject} sessions={sessions} />

      <section className="bg-white p-5 sm:p-6 rounded-3xl border border-sand-200 shadow-sm space-y-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-sand-800/60">Topics</h3>
          <p className="text-[11px] text-sand-800/50">Tap a status to change it. Rename, reorder or remove with the buttons.</p>
        </div>
        <ul className="space-y-2">
          {subject.topics.map((topic, i) => (
            <TopicRow
              key={topic.id}
              subject={subject}
              topic={topic}
              isFirst={i === 0}
              isLast={i === subject.topics.length - 1}
              minutes={totalMinutes(sessions.filter((s) => s.topicId === topic.id))}
            />
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            aria-label="Add a topic"
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTopic.trim()) {
                void addTopic(subject.id, newTopic.trim());
                setNewTopic('');
              }
            }}
            placeholder="Add a topic…"
            className="flex-1 min-w-0 p-2.5 bg-white border border-sand-200 rounded-xl text-xs text-sand-900 focus:outline-none"
          />
          <button
            onClick={() => {
              if (!newTopic.trim()) return;
              void addTopic(subject.id, newTopic.trim());
              setNewTopic('');
            }}
            disabled={!newTopic.trim()}
            className="px-3 py-2 bg-terracotta-400 hover:bg-terracotta-600 disabled:opacity-50 text-white text-xs font-semibold rounded-xl"
          >
            Add
          </button>
        </div>
      </section>

      <section className="bg-white p-5 sm:p-6 rounded-3xl border border-sand-200 shadow-sm space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-sand-800/60">Sessions</h3>
        {sessions.length === 0 ? (
          <p className="text-xs text-sand-800/60">No sessions yet — start the timer when you sit down to study.</p>
        ) : (
          <ul className="divide-y divide-sand-100">
            {sessions.map((s) => (
              <li key={s.id} className="py-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-sand-900">
                    {formatDisplayDate(s.date)} · {formatMinutes(s.minutes)}
                    {topicName(s.topicId) ? ` · ${topicName(s.topicId)}` : ''}
                  </p>
                  {s.notes && <p className="text-[11px] text-sand-800/70">{s.notes}</p>}
                </div>
                <button
                  onClick={() => void removeStudySession(s.id)}
                  className="text-[11px] text-sand-800/50 hover:text-terracotta-600 shrink-0"
                  aria-label={`Delete session from ${formatDisplayDate(s.date)}`}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button onClick={() => setConfirmRemove(true)} className="w-full py-2 text-[11px] font-semibold text-terracotta-600 hover:bg-terracotta-100 rounded-xl">
        Remove this subject
      </button>

      {confirmRemove && (
        <ConfirmInline
          title={`Remove ${subject.title}?`}
          description="Its topics and all its study sessions will be removed on all your devices."
          confirmLabel="Remove"
          onConfirm={async () => {
            await removeSubject(subject.id);
            showToast(`${subject.title} removed`);
            onBack();
          }}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
      {logging && (
        <StudySessionModal
          subjects={subjects}
          mode="manual"
          initialSubjectId={subject.id}
          onClose={() => setLogging(false)}
          onSaved={(msg) => {
            setLogging(false);
            showToast(msg);
          }}
        />
      )}
    </div>
  );
}

function TopicRow({ subject, topic, isFirst, isLast, minutes }: { subject: SubjectItem; topic: StudyTopic; isFirst: boolean; isLast: boolean; minutes: number }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(topic.name);
  const [confirm, setConfirm] = useState(false);
  const status = STATUS[topic.status];
  const small = 'w-7 h-7 flex items-center justify-center rounded-lg bg-sand-50 border border-sand-200 text-[11px] text-sand-800/70 disabled:opacity-30';

  return (
    <li className="p-2.5 bg-white border border-sand-200 rounded-xl space-y-2">
      {renaming ? (
        <div className="flex gap-2">
          <input aria-label="Topic name" value={name} onChange={(e) => setName(e.target.value)} className="flex-1 min-w-0 p-2 border border-sand-200 rounded-lg text-xs bg-white text-sand-900" />
          <button
            onClick={() => {
              if (name.trim()) void updateTopic(subject.id, topic.id, { name: name.trim() });
              setRenaming(false);
            }}
            className="px-2.5 bg-terracotta-400 text-white text-[11px] font-semibold rounded-lg"
          >
            Save
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-sand-900 min-w-0 truncate">
            {topic.name}
            {minutes > 0 && <span className="font-normal text-sand-800/50"> · {formatMinutes(minutes)}</span>}
          </p>
          <button
            onClick={() => void updateTopic(subject.id, topic.id, { status: status.next })}
            className={`px-2 py-1 rounded-lg border text-[10px] font-semibold shrink-0 ${status.style}`}
            aria-label={`${topic.name}: ${status.label}. Tap to change.`}
          >
            {status.label}
          </button>
        </div>
      )}
      <div className="flex gap-1.5 justify-end">
        <button onClick={() => void moveTopic(subject.id, topic.id, -1)} disabled={isFirst} className={small} aria-label={`Move ${topic.name} up`}>
          ↑
        </button>
        <button onClick={() => void moveTopic(subject.id, topic.id, 1)} disabled={isLast} className={small} aria-label={`Move ${topic.name} down`}>
          ↓
        </button>
        <button onClick={() => setRenaming(true)} className={`${small} w-auto px-2`}>
          Rename
        </button>
        <button onClick={() => setConfirm(true)} className={`${small} w-auto px-2 hover:text-terracotta-600`}>
          Remove
        </button>
      </div>
      {confirm && (
        <ConfirmInline
          title={`Remove "${topic.name}"?`}
          description="Sessions already logged for it are kept (they'll just show without a topic)."
          confirmLabel="Remove"
          onConfirm={() => {
            void removeTopic(subject.id, topic.id);
            setConfirm(false);
          }}
          onCancel={() => setConfirm(false)}
        />
      )}
    </li>
  );
}

function DetailsEditor({ subject, onDone }: { subject: SubjectItem; onDone: () => void }) {
  const [title, setTitle] = useState(subject.title);
  const [icon, setIcon] = useState(subject.icon ?? '');
  const [goal, setGoal] = useState(subject.goal ?? '');
  const [goalDate, setGoalDate] = useState(subject.goalDate ?? '');
  const field = 'w-full p-2.5 bg-white border border-sand-200 rounded-xl text-xs text-sand-900 focus:outline-none';
  return (
    <div className="space-y-2.5">
      <div className="flex gap-2">
        <input aria-label="Emoji" value={icon} onChange={(e) => setIcon(e.target.value)} className={`${field} w-16 text-center`} />
        <input aria-label="Subject name" value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
      </div>
      <input aria-label="Goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Goal — e.g. JLPT N5" className={field} />
      <DateField label="Goal date (optional)" value={goalDate} onChange={setGoalDate} />
      <div className="flex gap-2">
        <button
          onClick={async () => {
            if (!title.trim()) return;
            await updateSubject(subject.id, { title: title.trim(), icon: icon.trim() || undefined, goal: goal.trim() || undefined, goalDate: goalDate || undefined });
            onDone();
          }}
          className="flex-1 py-2 bg-terracotta-400 hover:bg-terracotta-600 text-white text-[11px] font-semibold rounded-lg"
        >
          Save
        </button>
        <button onClick={onDone} className="flex-1 py-2 bg-sand-100 text-sand-900 text-[11px] font-semibold rounded-lg">
          Cancel
        </button>
      </div>
    </div>
  );
}
