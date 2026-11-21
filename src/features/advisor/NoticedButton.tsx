import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import { useAdvice } from './useAdvice';
import AdviceList from './AdviceList';

/** Header button: today's advice from any tab, with a dot when there's something new you haven't seen. */
export default function NoticedButton() {
  const advice = useAdvice();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          advice.markSeen();
        }}
        className="relative text-[11px] flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-50/70 font-semibold transition-colors"
        aria-label={advice.hasUnseen ? 'Noticed for You — new advice' : 'Noticed for You'}
      >
        <span aria-hidden="true">🧭</span> Noticed
        {advice.hasUnseen && <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-terracotta-400 ml-0.5" />}
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)}>
          <ModalHeader icon="🧭" title="Noticed for You" onClose={() => setOpen(false)} />
          <p className="text-xs text-sand-800/60 -mt-3">Gentle advice from what you've logged. Worked out privately on this device.</p>
          <AdviceList picks={advice.picks} hasAnyData={advice.hasAnyData} onNotHelpful={advice.notHelpful} />
        </Modal>
      )}
    </>
  );
}
