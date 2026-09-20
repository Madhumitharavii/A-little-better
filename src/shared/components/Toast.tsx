interface ToastProps {
  message: string | null;
}

export default function Toast({ message }: ToastProps) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 right-6 left-6 sm:left-auto z-50 bg-sand-900 text-sand-50 px-4 py-3 rounded-2xl shadow-xl text-xs flex items-center gap-2">
      <span>✨</span> {message}
    </div>
  );
}
