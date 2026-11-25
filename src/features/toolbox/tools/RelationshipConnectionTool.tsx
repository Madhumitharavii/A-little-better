import Modal, { ModalHeader } from '@/shared/components/Modal';
import { markContactedToday } from '@/db/repositories/peopleRepository';
import { usePeople } from '@/features/people/usePeople';
import { describeLastContact } from '@/features/people/lastContact';
import { getLocalDateKey } from '@/db/dateUtils';

interface RelationshipConnectionToolProps {
  onClose: () => void;
  onComplete: () => void;
  /** Called when a person is tapped — ticks today's connection without closing the tool. */
  onConnected: () => void;
}

export default function RelationshipConnectionTool({ onClose, onComplete, onConnected }: RelationshipConnectionToolProps) {
  const people = usePeople();
  const today = getLocalDateKey();

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="💛" title="Relationship Connection" onClose={onClose} />

      <p className="text-xs text-sand-800/80 leading-relaxed">
        A reminder to intentionally connect with someone you care about.
      </p>

      {people.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-sand-900">Who did you reach out to?</p>
          <div className="grid grid-cols-2 gap-2">
            {people.map((person) => {
              const doneToday = person.lastContactedAt?.slice(0, 10) === today;
              return (
                <button
                  key={person.id}
                  onClick={() => {
                    if (doneToday) return;
                    void markContactedToday(person.id);
                    onConnected();
                  }}
                  aria-pressed={doneToday}
                  className={`p-2.5 rounded-2xl border text-left transition-all ${
                    doneToday
                      ? 'bg-sage-100 border-sage-500/40'
                      : 'bg-sand-50 hover:bg-sand-100 border-sand-200'
                  }`}
                >
                  <span className="block text-xs font-semibold text-sand-900 truncate">
                    {doneToday ? '✓ ' : ''}
                    {person.name}
                  </span>
                  <span className="block text-[10px] text-sand-800/60">
                    {doneToday ? 'Connected today' : `Last: ${describeLastContact(person.lastContactedAt)}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-sand-800/60 bg-sand-50 border border-sand-200 rounded-2xl px-3 py-2">
          Tip: add the people you want to stay close to under Me → My People, and they'll show up here.
        </p>
      )}

      <button
        onClick={onComplete}
        className="w-full py-2.5 bg-terracotta-400 hover:bg-terracotta-600 text-white text-xs font-semibold rounded-2xl transition-colors"
      >
        Mark Relationship Connection Logged
      </button>
    </Modal>
  );
}
