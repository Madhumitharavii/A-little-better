import { useEffect } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import type { LetterItem } from '@/db/schema';
import { markLetterRead } from '@/db/repositories/letterRepository';
import { longDate } from './letters';

export default function ReadLetterModal({ letter, onClose }: { letter: LetterItem; onClose: () => void }) {
  useEffect(() => {
    if (!letter.readAt) void markLetterRead(letter.id);
  }, [letter.id, letter.readAt]);

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-lg">
      <ModalHeader icon="💌" title="From your past self" onClose={onClose} />
      <p className="text-[11px] text-sand-800/60 -mt-2">
        Written {longDate(letter.writtenOn)} · opened {longDate(letter.openOn)}
      </p>
      <div className="bg-sand-50 border border-sand-200 rounded-2xl p-5 sm:p-6">
        <p className="serif text-[15px] leading-relaxed text-sand-900 whitespace-pre-wrap break-words">{letter.body}</p>
      </div>
    </Modal>
  );
}
