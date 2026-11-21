interface TodayFocusBannerProps {
  myselfDone: boolean;
  spaceDone: boolean;
  peopleDone: boolean;
}

/**
 * "Today, take care of" — the day's three gentle priorities at a
 * glance. Each one shows a ✓ once something for it is done today, and
 * tapping it scrolls to where you do it (Care for Me / Care Around Me).
 */
export default function TodayFocusBanner({ myselfDone, spaceDone, peopleDone }: TodayFocusBannerProps) {
  const goTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const items = [
    { icon: '🛀', title: 'For Myself', hint: 'A warm bath or eating fresh fruit', done: myselfDone, target: 'care-for-me', tint: 'bg-sage-100/70 border-sage-300/70 hover:bg-sage-100' },
    { icon: '🧹', title: 'For My Space', hint: 'A 5-minute primary desk reset', done: spaceDone, target: 'care-around-me', tint: 'bg-terracotta-100/70 border-terracotta-400/25 hover:bg-terracotta-100' },
    { icon: '💬', title: 'For My People', hint: 'Check nightly messages, or say hi', done: peopleDone, target: 'care-around-me', tint: 'bg-slate-100 border-slate-500/20 hover:bg-slate-100/70' },
  ];

  return (
    <section className="bg-white p-5 rounded-3xl border border-sand-200 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-sand-800/60 flex items-center gap-1.5">
          <span>✨</span> Today, take care of:
        </h3>
        <span className="text-[11px] text-sand-800/50">Gentle priorities, not mandatory tasks</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
        {items.map((item) => (
          <button
            key={item.title}
            onClick={() => goTo(item.target)}
            className={`p-3 border rounded-2xl flex items-start gap-2 text-left transition-colors ${
              item.done ? 'bg-sage-100 border-sage-500/50' : item.tint
            }`}
          >
            <span className="text-base">{item.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-sand-900">{item.title}</span>
              <span className="block text-[11px] text-sand-800/70">{item.done ? 'Done today ✓' : item.hint}</span>
            </span>
            <span aria-hidden="true" className="text-sand-800/40 self-center">{item.done ? '' : '›'}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
