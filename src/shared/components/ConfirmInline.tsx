interface ConfirmInlineProps {
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmInline({
  title,
  description = "This can't be undone from within the app.",
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: ConfirmInlineProps) {
  return (
    <div className="fixed inset-0 z-[60] bg-sand-900/40 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-sand-200 space-y-4">
        <h3 className="serif text-lg font-semibold text-sand-900">{title}</h3>
        <p className="text-xs text-sand-800/70">{description}</p>
        <div className="flex gap-3">
          <button onClick={onConfirm} className="flex-1 py-2.5 bg-terracotta-600 hover:bg-terracotta-600/90 text-white text-xs font-semibold rounded-2xl">
            {confirmLabel}
          </button>
          <button onClick={onCancel} className="flex-1 py-2.5 bg-sand-100 hover:bg-sand-200 text-sand-900 text-xs font-semibold rounded-2xl">
            Keep it
          </button>
        </div>
      </div>
    </div>
  );
}
