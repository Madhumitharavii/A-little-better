import { createPortal } from 'react-dom';

interface ToastProps {
  message: string | null;
}

export default function Toast({ message }: ToastProps) {
  if (!message) return null;
  // Above dialogs (z-50) and confirmations (z-[60]), so a message shown while one is open is visible.
  return createPortal(
    <div className="fixed bottom-6 right-6 left-6 sm:left-auto z-[70] bg-sand-900 text-sand-50 px-4 py-3 rounded-2xl shadow-xl text-xs flex items-center gap-2">
      <span>✨</span> {message}
    </div>,
    document.body,
  );
}
