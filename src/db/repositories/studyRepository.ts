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

export function selectSubjects(all: readonly { type: string; deletedAt?: string | null }[]): SubjectItem[] {
  return (all.filter((r) => r.type === 'subject' && !r.deletedAt) as unknown as SubjectItem[]).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export function selectStudySessions(all: readonly { type: string; deletedAt?: string | null }[]): StudySessionItem[] {
  return (all.filter((r) => r.type === 'studySession' && !r.deletedAt) as unknown as StudySessionItem[]).sort(
    (a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)),
  );
}

export async function getSubjects(): Promise<SubjectItem[]> {
  return selectSubjects(await table().toArray());
}

export async function getStudySessions(): Promise<StudySessionItem[]> {
  return selectStudySessions(await table().toArray());
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

export async function logStudySession(input: { subject: SubjectItem; topicId?: string; minutes: number; date?: string; note?: string; fromFocus?: boolean }): Promise<StudySessionItem> {
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
    fromFocus: input.fromFocus || undefined,
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

// ── duplicates ──

const TOPIC_RANK: Record<StudyTopic['status'], number> = { notStarted: 0, learning: 1, confident: 2 };

/**
 * Merges subjects with the same name (e.g. the starter subjects added on
 * both phone and Mac before they synced). The OLDEST copy is kept — every
 * device picks the same one — and gets the other copies' topics (matched
 * by name, keeping the furthest progress), goals and study sessions.
 * The extra copies are marked deleted, which syncs like any delete.
 * Returns how many duplicates were merged.
 */
export async function mergeDuplicateSubjects(): Promise<number> {
  const rows = await table().toArray();
  const subjects = selectSubjects(rows);
  const sessions = selectStudySessions(rows);
  const groups = new Map<string, SubjectItem[]>();
  for (const s of subjects) {
    const key = s.title.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }

  const now = nowIso();
  const writes: (SubjectItem | StudySessionItem)[] = [];
  let merged = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const [keep, ...extras] = [...group].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || a.id.localeCompare(b.id));
    const topics = keep.topics.map((t) => ({ ...t }));
    const kept: SubjectItem = { ...keep, topics };
    for (const extra of extras) {
      const topicMap = new Map<string, string>();
      for (const t of extra.topics ?? []) {
        const same = topics.find((k) => k.name.trim().toLowerCase() === t.name.trim().toLowerCase());
        if (same) {
          topicMap.set(t.id, same.id);
          if (TOPIC_RANK[t.status] > TOPIC_RANK[same.status]) same.status = t.status;
        } else {
          topics.push({ ...t });
          topicMap.set(t.id, t.id);
        }
      }
      kept.weeklyGoal ??= extra.weeklyGoal;
      kept.goal ??= extra.goal;
      kept.goalDate ??= extra.goalDate;
      kept.icon ??= extra.icon;
      for (const s of sessions.filter((x) => x.subjectId === extra.id)) {
        writes.push({ ...s, subjectId: keep.id, topicId: s.topicId ? topicMap.get(s.topicId) ?? s.topicId : undefined, updatedAt: now });
      }
      writes.push({ ...extra, deletedAt: now, updatedAt: now });
      merged++;
    }
    writes.push({ ...kept, updatedAt: now });
  }
  // Sessions still pointing at a subject that was merged away elsewhere (e.g. logged on
  // another device before it heard about the merge): move them to the live subject with
  // the same name, so their minutes aren't lost.
  const liveByTitle = new Map<string, SubjectItem>();
  for (const [key, group] of groups) {
    const keep = [...group].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || a.id.localeCompare(b.id))[0];
    liveByTitle.set(key, keep);
  }
  const deletedSubjects = (rows.filter((r) => r.type === 'subject' && r.deletedAt) as unknown as SubjectItem[]).filter((d) => !subjects.some((s) => s.id === d.id));
  const repointed = new Set(writes.filter((w) => w.type === 'studySession').map((w) => w.id));
  for (const gone of deletedSubjects) {
    const target = liveByTitle.get(gone.title.trim().toLowerCase());
    if (!target) continue;
    for (const session of sessions.filter((x) => x.subjectId === gone.id && !repointed.has(x.id))) {
      const topic = gone.topics?.find((t) => t.id === session.topicId);
      const mapped = topic ? target.topics.find((t) => t.name.trim().toLowerCase() === topic.name.trim().toLowerCase())?.id : undefined;
      writes.push({ ...session, subjectId: target.id, topicId: mapped, updatedAt: now });
    }
  }

  if (writes.length) await table().bulkPut(writes);
  return merged;
}
