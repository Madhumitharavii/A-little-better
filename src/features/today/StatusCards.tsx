interface StatusCardProps {
  icon: string;
  title: string;
  description: string;
  doneLabel: string;
  buttonLabel: string;
  buttonIcon: string;
  isDone: boolean;
  buttonClassName: string;
  onOpen: () => void;
}

function StatusCard({
  icon,
  title,
  description,
  doneLabel,
  buttonLabel,
  buttonIcon,
  isDone,
  buttonClassName,
  onOpen,
}: StatusCardProps) {
  return (
    <section className="bg-white p-5 sm:p-6 rounded-3xl border border-sand-200 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2 border-b border-sand-100 pb-3">
        <h3 className="serif text-lg sm:text-xl text-sand-900 font-semibold flex items-center gap-2 min-w-0">
          <span className="shrink-0">{icon}</span> <span className="truncate">{title}</span>
        </h3>
        {isDone && (
          <span className="text-[11px] bg-sage-100 text-sage-700 px-2.5 py-0.5 rounded-full font-medium shrink-0">
            {doneLabel}
          </span>
        )}
      </div>
      <p className="text-xs text-sand-800/70 mb-4">{description}</p>

      <button
        onClick={onOpen}
        className={`w-full py-3 sm:py-2.5 px-4 text-xs font-semibold rounded-2xl transition-all flex items-center justify-center gap-2 ${buttonClassName}`}
      >
        <span>{buttonIcon}</span> {buttonLabel}
      </button>
    </section>
  );
}

export function SpaceResetCard({ isDone, onOpen }: { isDone: boolean; onOpen: () => void }) {
  return (
    <StatusCard
      icon="🧹"
      title="Care for Space"
      description="5 minutes to restore calm to your primary desk or surface."
      doneLabel="Reset Done ✓"
      buttonLabel={isDone ? 'Do Another 5-Min Reset' : 'Start 5-Minute Room Reset'}
      buttonIcon="⏱️"
      isDone={isDone}
      buttonClassName="bg-sand-100 hover:bg-sand-200/70 text-sand-900"
      onOpen={onOpen}
    />
  );
}

export function MessageResetCard({ isDone, onOpen }: { isDone: boolean; onOpen: () => void }) {
  return (
    <StatusCard
      icon="💬"
      title="Digital: Message Reset"
      description="Nightly manual check to handle outstanding messages so your mind rests easy."
      doneLabel="Cleared ✓"
      buttonLabel="Open Nightly Message Check"
      buttonIcon="🌙"
      isDone={isDone}
      buttonClassName="bg-slate-100 hover:bg-slate-200/80 text-slate-800"
      onOpen={onOpen}
    />
  );
}

export function RelationshipCard({ isDone, onOpen }: { isDone: boolean; onOpen: () => void }) {
  return (
    <StatusCard
      icon="💛"
      title="People: Relationship Connection"
      description="A gentle reminder to intentionally reach out to someone you care about."
      doneLabel="Connected ✓"
      buttonLabel="View Connection Reminders & Ideas"
      buttonIcon="✨"
      isDone={isDone}
      buttonClassName="bg-terracotta-100/60 hover:bg-terracotta-100 text-terracotta-600"
      onOpen={onOpen}
    />
  );
}
