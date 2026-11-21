import { useState } from 'react';
import type { Person } from '@/db/schema';
import { savePerson, updatePerson, removePerson } from '@/db/repositories/peopleRepository';
import ConfirmInline from '@/shared/components/ConfirmInline';
import { usePeople } from './usePeople';
import { describeLastContact } from './lastContact';

/**
 * My People, on the Me page: the people I want to stay connected with.
 * Add someone, tap a name to edit their details or remove them. Who I
 * reached out to is logged from Today's Relationship Connection tool.
 */
export default function PeopleSection({ showToast }: { showToast: (msg: string) => void }) {
  const people = usePeople();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const addPerson = async () => {
    const name = newName.trim();
    if (!name) return;
    await savePerson({ name });
    setNewName('');
    showToast(`${name} added 💛`);
  };

  return (
    <div className="p-3 bg-terracotta-100/50 rounded-2xl border border-terracotta-400/20 space-y-3">
      <div>
        <p className="font-semibold text-sand-900 text-xs">💛 My People</p>
        <p className="text-[11px] text-sand-800/60 mt-1">
          The people I want to stay close to. Log who you reached out to from Today's Relationship Connection.
        </p>
      </div>

      {people.length > 0 && (
        <ul className="space-y-1.5">
          {people.map((person) =>
            editingId === person.id ? (
              <PersonEditor
                key={person.id}
                person={person}
                onDone={() => setEditingId(null)}
                showToast={showToast}
              />
            ) : (
              <li key={person.id}>
                <button
                  onClick={() => setEditingId(person.id)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 bg-white border border-sand-200 rounded-xl text-left hover:bg-sand-100/60"
                  aria-label={`Edit ${person.name}`}
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-sand-900 truncate">{person.name}</span>
                    {(person.relationship || person.notes) && (
                      <span className="block text-[10px] text-sand-800/60 truncate">
                        {[person.relationship, person.notes].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-sand-800/60 shrink-0">
                    Last connected: {describeLastContact(person.lastContactedAt)}
                  </span>
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          aria-label="Add a person"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void addPerson();
          }}
          placeholder="Add someone…"
          className="flex-1 min-w-0 p-2.5 bg-white border border-sand-200 rounded-xl text-xs text-sand-900 focus:outline-none"
        />
        <button
          onClick={addPerson}
          disabled={!newName.trim()}
          className="px-3 py-2 bg-terracotta-400 hover:bg-terracotta-600 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shrink-0"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function PersonEditor({
  person,
  onDone,
  showToast,
}: {
  person: Person;
  onDone: () => void;
  showToast: (msg: string) => void;
}) {
  const [name, setName] = useState(person.name);
  const [relationship, setRelationship] = useState(person.relationship ?? '');
  const [notes, setNotes] = useState(person.notes ?? '');
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    await updatePerson(person.id, {
      name: name.trim(),
      relationship: relationship.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    onDone();
  };

  const field = 'w-full p-2 bg-white border border-sand-200 rounded-lg text-xs text-sand-900 focus:outline-none';

  return (
    <li className="p-3 bg-white border border-sand-300 rounded-xl space-y-2">
      <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={field} />
      <input
        aria-label="Who they are to me (optional)"
        value={relationship}
        onChange={(e) => setRelationship(e.target.value)}
        placeholder="Who they are to me (optional) — friend, sister…"
        className={field}
      />
      <textarea
        aria-label="Notes (optional)"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional) — birthday, things to ask about…"
        className={`${field} resize-none`}
      />
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={!name.trim()}
          className="flex-1 py-2 bg-terracotta-400 hover:bg-terracotta-600 disabled:opacity-50 text-white text-[11px] font-semibold rounded-lg"
        >
          Save
        </button>
        <button onClick={onDone} className="flex-1 py-2 bg-sand-100 hover:bg-sand-200 text-sand-900 text-[11px] font-semibold rounded-lg">
          Cancel
        </button>
        <button
          onClick={() => setConfirmingRemove(true)}
          className="px-3 py-2 text-terracotta-600 hover:bg-terracotta-100 text-[11px] font-semibold rounded-lg"
        >
          Remove
        </button>
      </div>
      {confirmingRemove && (
        <ConfirmInline
          title={`Remove ${person.name}?`}
          description="They'll be removed from My People on all your devices."
          confirmLabel="Remove"
          onConfirm={async () => {
            await removePerson(person.id);
            showToast(`${person.name} removed`);
            onDone();
          }}
          onCancel={() => setConfirmingRemove(false)}
        />
      )}
    </li>
  );
}
