interface EveningReflectionCardProps {
  gratitude: string;
  smallWin: string;
  onChange: (field: 'gratitude' | 'smallWin', value: string) => void;
}

export default function EveningReflectionCard({ gratitude, smallWin, onChange }: EveningReflectionCardProps) {
  return (
    <section className="bg-white p-5 sm:p-8 rounded-3xl border border-sand-200 shadow-sm space-y-4">
      <div className="border-b border-sand-100 pb-3">
        <h3 className="serif text-xl text-sand-900 font-semibold">Today's Reflection</h3>
        <p className="text-xs text-sand-800/60">No pressure. Unpack the day with soft notes.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-sand-800 mb-1.5">Something I am grateful for today</label>
          <textarea
            rows={2}
            value={gratitude}
            onChange={(e) => onChange('gratitude', e.target.value)}
            placeholder="A warm coffee, soft sunlight, a quiet moment..."
            className="w-full p-3 bg-sand-50/50 border border-sand-200 rounded-2xl text-xs text-sand-900 focus:outline-none focus:border-sand-300 resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-sand-800 mb-1.5">A small win or quiet progress</label>
          <textarea
            rows={2}
            value={smallWin}
            onChange={(e) => onChange('smallWin', e.target.value)}
            placeholder="I started a tough task, drank fresh water, rested well..."
            className="w-full p-3 bg-sand-50/50 border border-sand-200 rounded-2xl text-xs text-sand-900 focus:outline-none focus:border-sand-300 resize-none"
          />
        </div>
      </div>
    </section>
  );
}
