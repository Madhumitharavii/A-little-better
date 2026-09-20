export default function TodayFocusBanner() {
  return (
    <section className="bg-white p-5 rounded-3xl border border-sand-200 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-sand-800/60 flex items-center gap-1.5">
          <span>✨</span> Today, take care of:
        </h3>
        <span className="text-[11px] text-sand-800/50">Gentle priorities, not mandatory tasks</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
        <div className="p-3 bg-sand-50/70 border border-sand-200 rounded-2xl flex items-start gap-2">
          <span className="text-base">🛀</span>
          <div>
            <p className="font-semibold text-sand-900">For Myself</p>
            <p className="text-[11px] text-sand-800/70">A warm bath or eating fresh fruit</p>
          </div>
        </div>
        <div className="p-3 bg-sand-50/70 border border-sand-200 rounded-2xl flex items-start gap-2">
          <span className="text-base">🧹</span>
          <div>
            <p className="font-semibold text-sand-900">For My Space</p>
            <p className="text-[11px] text-sand-800/70">A 5-minute primary desk reset</p>
          </div>
        </div>
        <div className="p-3 bg-sand-50/70 border border-sand-200 rounded-2xl flex items-start gap-2">
          <span className="text-base">💬</span>
          <div>
            <p className="font-semibold text-sand-900">For My People</p>
            <p className="text-[11px] text-sand-800/70">Check nightly messages,<br />or say hi</p>
          </div>
        </div>
      </div>
    </section>
  );
}
