import { db } from '../db';
import { generateId, nowIso } from '../id';
import { getLocalDateKey } from '../dateUtils';
import type { LifeItem, StudySessionItem, StudyTopic, SubjectItem, TopicStatus } from '../schema';

/**
 * Study log — subjects (with their topics) and study sessions. Lives in
 * the lifeItems table (see the STUDY note in schema.ts); these are the
 * only functions that read or write those rows.
 */

// The table is typed for Life items; study rows share it, so cast at this one boundary.
const table = () => db.lifeItems as unknown as import('dexie').Table<SubjectItem | StudySessionItem, string>;

export async function getSubjects(): Promise<SubjectItem[]> {
  const rows = await table().where('type').equals('subject').toArray();
  return (rows as SubjectItem[]).filter((s) => !s.deletedAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getStudySessions(): Promise<StudySessionItem[]> {
  const rows = await table().where('type').equals('studySession').toArray();
  return (rows as StudySessionItem[]).filter((s) => !s.deletedAt).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export async function createSubject(input: { title: string; icon?: string; goal?: string; goalDate?: string; topicNames?: string[] }, createdAt?: string): Promise<SubjectItem> {
  // Subjects are listed in the order they were created.
  const timestamp = createdAt ?? nowIso();
  const subject: SubjectItem = {
    id: generateId(),
    type: 'subject',
    title: input.title,
    icon: input.icon,
    goal: input.goal,
    goalDate: input.goalDate,
    topics: (input.topicNames ?? []).map((name) => ({ id: generateId(), name, status: 'notStarted' as TopicStatus })),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await table().add(subject);
  return subject;
}

type SubjectPatch = Partial<Pick<SubjectItem, 'title' | 'icon' | 'goal' | 'goalDate' | 'topics' | 'weeklyGoal'>>;

export async function updateSubject(id: string, patch: SubjectPatch): Promise<void> {
  const existing = (await table().get(id)) as SubjectItem | undefined;
  if (!existing || existing.type !== 'subject') return;
  await table().put({ ...existing, ...patch, updatedAt: nowIso() });
}

/** Removes a subject and its sessions (soft delete, so it reaches other devices). */
export async function removeSubject(id: string): Promise<void> {
  const timestamp = nowIso();
  const subject = await table().get(id);
  if (subject) await table().put({ ...subject, deletedAt: timestamp, updatedAt: timestamp });
  const sessions = (await getStudySessions()).filter((s) => s.subjectId === id);
  for (const s of sessions) await table().put({ ...s, deletedAt: timestamp, updatedAt: timestamp });
}

// ── topics (edited as part of their subject) ──

export async function addTopic(subjectId: string, name: string): Promise<void> {
  const subject = (await table().get(subjectId)) as SubjectItem | undefined;
  if (!subject) return;
  const topic: StudyTopic = { id: generateId(), name, status: 'notStarted' };
  await updateSubject(subjectId, { topics: [...subject.topics, topic] });
}

export async function updateTopic(subjectId: string, topicId: string, patch: Partial<Pick<StudyTopic, 'name' | 'status'>>): Promise<void> {
  const subject = (await table().get(subjectId)) as SubjectItem | undefined;
  if (!subject) return;
  await updateSubject(subjectId, { topics: subject.topics.map((t) => (t.id === topicId ? { ...t, ...patch } : t)) });
}

export async function removeTopic(subjectId: string, topicId: string): Promise<void> {
  const subject = (await table().get(subjectId)) as SubjectItem | undefined;
  if (!subject) return;
  await updateSubject(subjectId, { topics: subject.topics.filter((t) => t.id !== topicId) });
}

export async function moveTopic(subjectId: string, topicId: string, direction: -1 | 1): Promise<void> {
  const subject = (await table().get(subjectId)) as SubjectItem | undefined;
  if (!subject) return;
  const topics = [...subject.topics];
  const i = topics.findIndex((t) => t.id === topicId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= topics.length) return;
  [topics[i], topics[j]] = [topics[j], topics[i]];
  await updateSubject(subjectId, { topics });
}

// ── sessions ──

export async function logStudySession(input: { subject: SubjectItem; topicId?: string; minutes: number; date?: string; note?: string }): Promise<StudySessionItem> {
  const timestamp = nowIso();
  const topic = input.subject.topics.find((t) => t.id === input.topicId);
  const session: StudySessionItem = {
    id: generateId(),
    type: 'studySession',
    title: topic ? `${input.subject.title} · ${topic.name}` : input.subject.title,
    subjectId: input.subject.id,
    topicId: topic?.id,
    date: input.date ?? getLocalDateKey(),
    minutes: input.minutes,
    notes: input.note?.trim() || undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await table().add(session);
  // Starting a topic moves it out of "Not started" automatically.
  if (topic && topic.status === 'notStarted') await updateTopic(input.subject.id, topic.id, { status: 'learning' });
  return session;
}

export async function removeStudySession(id: string): Promise<void> {
  const existing = await table().get(id);
  if (!existing) return;
  const timestamp = nowIso();
  await table().put({ ...existing, deletedAt: timestamp, updatedAt: timestamp });
}

/** Narrows rows from the shared table to study rows. */
export function isStudyRow(item: LifeItem | { type: string }): boolean {
  return item.type === 'subject' || item.type === 'studySession';
}

/** A starting point — every subject and topic can be renamed, removed, or added to. */
export const STARTER_SUBJECTS: { title: string; icon: string; topicNames: string[] }[] = [
  { title: 'Japanese', icon: '🇯🇵', topicNames: ['Hiragana', 'Katakana', 'Kanji', 'Vocabulary', 'Grammar', 'Listening'] },
  { title: 'Aptitude', icon: '🧮', topicNames: ['Quantitative', 'Logical reasoning', 'Verbal'] },
  { title: 'Python', icon: '🐍', topicNames: ['Basics', 'Data structures', 'OOP', 'Libraries (NumPy / Pandas)', 'Projects'] },
  {
    title: 'Machine Learning',
    icon: '🤖',
    topicNames: ['Math foundations', 'Supervised learning', 'Unsupervised learning', 'Deep learning', 'Projects'],
  },
];

export async function addStarterSubjects(): Promise<void> {
  const existing = new Set((await getSubjects()).map((s) => s.title.toLowerCase()));
  // A millisecond apart, so they always list in this order.
  const base = Date.now();
  for (const [i, starter] of STARTER_SUBJECTS.entries()) {
    if (!existing.has(starter.title.toLowerCase())) await createSubject(starter, new Date(base + i).toISOString());
  }
}
