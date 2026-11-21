import { useState } from 'react';
import { addStarterSubjects } from '@/db/repositories/studyRepository';
import type { SubjectItem } from '@/db/schema';
import { useSubjects, useStudySessions, sessionsWithin, totalMinutes, formatMinutes, daysAgoLabel } from './useStudy';
import { useStudyTimer, startStudyTimer, stopStudyTimer, formatClock } from './studyTimer';
import StudySessionModal from './StudySessionModal';
import AddSubjectModal from './AddSubjectModal';
import { goalProgress, weekBounds, describeProgress } from './goals';
import { GoalBar } from './WeeklyGoalSection';
import { getLocalDateKey } from '@/db/dateUtils';

interface StudySectionProps {
  showToast: (msg: string) => void;
  onOpenSubject: (id: string) => void;
}

/**
 * 📚 Learning, on the Week page: a start/stop study timer, your subjects
 * with this week's time and topic progress, and manual logging.
 */
export default function StudySection({ showToast, onOpenSubject }: StudySectionProps) {
  const subjects = useSubjects();
  const sessions = useStudySessions();
  const { timer, seconds } = useStudyTimer();
  const [pickSubjectId, setPickSubjectId] = useState<string | null>(null);
  const [pickTopicId, setPickTopicId] = useState<string | undefined>();
  const [saveAfterTimer, setSaveAfterTimer] = useState<{ subjectId: string; topicId?: string; minutes: number; date: string } | null>(null);
  const [logging, setLogging] = useState(false);
  const [addingSubject, setAddingSubject] = useState(false);

  if (!subjects) return null;

  const week = sessionsWithin(sessions, 7);
  const weekTotal = totalMinutes(week);
  const running = timer ? subjects.find((s) => s.id === timer.subjectId) : undefined;
  const runningTopic = running?.topics.find((t) => t.id === timer?.topicId);
  const chosen = subjects.find((s) => s.id === (pickSubjectId ?? subjects[0]?.id));

  const stop = () => {
    const ended = stopStudyTimer();
    if (!ended) return;
    const minutes = Math.max(1, Math.round((Date.now() - Date.parse(ended.startedAt)) / 60000));
    // Saved on the day you started.
    setSaveAfterTimer({ subjectId: ended.subjectId, topicId: ended.topicId, minutes, date: localKey(ended.startedAt) });
  };

  return (
    <section className="bg-slate-100/70 p-5 sm:p-6 rounded-3xl border border-slate-500/20 shadow-sm space-y-4">
      <div className="border-b border-sand-100 pb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="serif text-lg sm:text-xl text-sand-900 font-semibold">📚 Learning</h3>
          <p className="text-xs text-sand-800/60">What I'm studying, and the time I've given it.</p>
        </div>
        {weekTotal > 0 && (
          <span className="text-[11px] bg-sage-100 text-sage-700 px-2.5 py-1 rounded-full font-semibold shrink-0">
            {formatMinutes(weekTotal)} this week
          </span>
        )}
      </div>

      {subjects.length === 0 ? (
        <div className="space-y-2.5">
          <p className="text-xs text-sand-800/70">Add what you're learning, then time your study sessions.</p>
          <button
            onClick={async () => {
              await addStarterSubjects();
              showToast('Added Japanese, Aptitude, Python and Machine Learning — edit them any time.');
            }}
            className="w-full py-2.5 bg-terracotta-400 hover:bg-terracotta-600 text-white text-xs font-semibold rounded-2xl"
          >
            Start with Japanese, Aptitude, Python & Machine Learning
          </button>
          <button onClick={() => setAddingSubject(true)} className="w-full py-2.5 bg-sand-100 hover:bg-sand-200 text-sand-900 text-xs font-semibold rounded-2xl">
            + Add my own subject
          </button>
        </div>
      ) : (
        <>
          {/* Study timer */}
          {timer && running ? (
            <div className="p-4 bg-slate-100 border border-slate-500/20 rounded-2xl space-y-3 text-center">
              <p className="text-xs font-semibold text-slate-800">
                Studying {running.icon ? `${running.icon} ` : ''}
                {running.title}
                {runningTopic ? ` · ${runningTopic.name}` : ''}
              </p>
              <p className="serif text-4xl text-sand-900 tabular-nums" aria-live="off">
                {formatClock(seconds)}
              </p>
              <button onClick={stop} className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-2xl">
                ■ Stop & save
              </button>
              <p className="text-[10px] text-slate-500">Keeps counting even if you close the app.</p>
            </div>
          ) : (
            <div className="p-4 bg-sand-50 border border-sand-200 rounded-2xl space-y-3">
              <p className="text-xs font-semibold text-sand-900">⏱️ Study timer</p>
              <div className="flex flex-wrap gap-2">
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setPickSubjectId(s.id);
                      setPickTopicId(undefined);
                    }}
                    aria-pressed={chosen?.id === s.id}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-medium ${
                      chosen?.id === s.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-sand-200 text-sand-800'
                    }`}
                  >
                    {s.icon ? `${s.icon} ` : ''}
                    {s.title}
                  </button>
                ))}
              </div>
              {chosen && chosen.topics.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {chosen.topics.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setPickTopicId(t.id === pickTopicId ? undefined : t.id)}
                      aria-pressed={t.id === pickTopicId}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] ${
                        t.id === pickTopicId ? 'bg-sage-100 border-sage-500/40 text-sage-700 font-semibold' : 'bg-white border-sand-200 text-sand-800/80'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => chosen && startStudyTimer(chosen.id, pickTopicId)}
                disabled={!chosen}
                className="w-full py-2.5 bg-terracotta-400 hover:bg-terracotta-600 disabled:opacity-50 text-white text-xs font-semibold rounded-2xl"
              >
                ▶ Start studying{chosen ? ` ${chosen.title}` : ''}
              </button>
            </div>
          )}

          {/* Subjects */}
          <ul className="space-y-2">
            {subjects.map((s) => (
              <SubjectRow key={s.id} subject={s} sessions={sessions.filter((x) => x.subjectId === s.id)} onOpen={() => onOpenSubject(s.id)} />
            ))}
          </ul>

          <div className="flex gap-2">
            <button onClick={() => setLogging(true)} className="flex-1 py-2 bg-sand-100 hover:bg-sand-200 text-sand-900 text-[11px] font-semibold rounded-xl">
              + Add a session by hand
            </button>
            <button onClick={() => setAddingSubject(true)} className="flex-1 py-2 bg-sand-100 hover:bg-sand-200 text-sand-900 text-[11px] font-semibold rounded-xl">
              + Add subject
            </button>
          </div>
        </>
      )}

      {saveAfterTimer && (
        <StudySessionModal
          subjects={subjects}
          mode="timer"
          initialSubjectId={saveAfterTimer.subjectId}
          initialTopicId={saveAfterTimer.topicId}
          initialMinutes={saveAfterTimer.minutes}
          initialDate={saveAfterTimer.date}
          onClose={() => setSaveAfterTimer(null)}
          onSaved={(msg) => {
            setSaveAfterTimer(null);
            showToast(msg);
          }}
        />
      )}
      {logging && (
        <StudySessionModal
          subjects={subjects}
          mode="manual"
          onClose={() => setLogging(false)}
          onSaved={(msg) => {
            setLogging(false);
            showToast(msg);
          }}
        />
      )}
      {addingSubject && (
        <AddSubjectModal
          onClose={() => setAddingSubject(false)}
          onSaved={(title) => {
            setAddingSubject(false);
            showToast(`${title} added 📚`);
          }}
        />
      )}
    </section>
  );
}

/** The local calendar date (YYYY-MM-DD) of an ISO timestamp. */
function localKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function SubjectRow({ subject, sessions, onOpen }: { subject: SubjectItem; sessions: import('@/db/schema').StudySessionItem[]; onOpen: () => void }) {
  const week = totalMinutes(sessionsWithin(sessions, 7));
  const goal = goalProgress(subject, sessions, weekBounds(getLocalDateKey()).start);
  const confident = subject.topics.filter((t) => t.status === 'confident').length;
  const learning = subject.topics.filter((t) => t.status === 'learning').length;
  const total = subject.topics.length;
  const last = sessions[0]?.date;
  return (
    <li>
      <button onClick={onOpen} className="w-full p-3 bg-white border border-sand-200 rounded-2xl text-left hover:bg-sand-50 space-y-2" aria-label={`Open ${subject.title}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sand-900 truncate">
              {subject.icon ? `${subject.icon} ` : ''}
              {subject.title}
            </p>
            <p className="text-[11px] text-sand-800/60 truncate">
              {[subject.goal, last ? `last studied ${daysAgoLabel(last)}` : 'not studied yet'].filter(Boolean).join(' · ')}
            </p>
          </div>
          <span className="text-[11px] text-sand-800/70 shrink-0">
            {goal.hasGoal ? (goal.met ? '🎯 Goal met' : describeProgress(goal)) : week ? `${formatMinutes(week)} this week` : '—'}
          </span>
        </div>
        {goal.hasGoal && !goal.met && (
          <div className="space-y-1.5">
            {goal.minutesGoal && <GoalBar value={goal.minutes} goal={goal.minutesGoal} label="Weekly time" />}
            {goal.daysGoal && <GoalBar value={goal.days} goal={goal.daysGoal} label="Weekly days" />}
          </div>
        )}
        {total > 0 && (
          <div className="space-y-1">
            <div className="h-1.5 bg-sand-100 rounded-full overflow-hidden flex" aria-hidden="true">
              <span className="bg-sage-500" style={{ width: `${(confident / total) * 100}%` }} />
              <span className="bg-sage-300" style={{ width: `${(learning / total) * 100}%` }} />
            </div>
            <p className="text-[10px] text-sand-800/50">
              {confident} confident · {learning} learning · {total - confident - learning} not started
            </p>
          </div>
        )}
      </button>
    </li>
  );
}
