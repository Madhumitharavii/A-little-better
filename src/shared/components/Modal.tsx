import { type ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  maxWidthClassName?: string;
}

/** The shared backdrop + card shell used by every tool and dialog. */
export default function Modal({ onClose, children, maxWidthClassName = 'max-w-lg' }: ModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Move keyboard focus into the dialog when it opens, and back where it was when it closes.
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    if (!cardRef.current?.contains(document.activeElement)) cardRef.current?.focus(); // keep a text box's own autofocus
    return () => previous?.focus?.();
  }, []);

  // Rendered at the end of <body>, so it always sits above everything — including the
  // desktop sidebar, which is its own layer (dialogs opened from it used to sit under the page).
  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-sand-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        className={`bg-white rounded-3xl p-6 sm:p-8 w-full ${maxWidthClassName} shadow-2xl border border-sand-200 space-y-6 max-h-[90vh] overflow-y-auto focus:outline-none`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

interface ModalHeaderProps {
  icon: string;
  title: string;
  onClose: () => void;
}

export function ModalHeader({ icon, title, onClose }: ModalHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-sand-100 pb-3 -mt-1">
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <h3 className="serif text-xl font-semibold text-sand-900">{title}</h3>
      </div>
      <button
        onClick={onClose}
        aria-label="Close"
        className="text-sand-800/60 hover:text-sand-900 text-sm font-semibold p-1"
      >
        ✕
      </button>
    </div>
  );
}
