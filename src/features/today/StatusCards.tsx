/**
 * "Around me" — the three gentle care actions beyond myself (my space,
 * my messages, my people), shown together in ONE card with a row each,
 * instead of three separate tall cards. Every row keeps its own
 * description, done badge, and button.
 */

interface CareRowProps {
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

function CareRow({ icon, title, description, doneLabel, buttonLabel, buttonIcon, isDone, buttonClassName, onOpen }: CareRowProps) {
  return (
    <div className="py-4 first:pt-0 last:pb-0 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-sand-900 flex items-center gap-2">
            <span className="shrink-0">{icon}</span> <span className="truncate">{title}</span>
          </p>
          <p className="text-[11px] text-sand-800/70 mt-0.5">{description}</p>
        </div>
        {isDone && (
          <span className="text-[11px] bg-sage-100 text-sage-700 px-2.5 py-0.5 rounded-full font-medium shrink-0">
            {doneLabel}
          </span>
        )}
      </div>
      <button
        onClick={onOpen}
        className={`w-full py-2.5 px-4 text-xs font-semibold rounded-2xl transition-all flex items-center justify-center gap-2 ${buttonClassName}`}
      >
        <span>{buttonIcon}</span> {buttonLabel}
      </button>
    </div>
  );
}

interface AroundMeCardProps {
  spaceDone: boolean;
  messagesDone: boolean;
  peopleDone: boolean;
  onOpenSpace: () => void;
  onOpenMessages: () => void;
  onOpenPeople: () => void;
}

export default function AroundMeCard({
  spaceDone,
  messagesDone,
  peopleDone,
  onOpenSpace,
  onOpenMessages,
  onOpenPeople,
}: AroundMeCardProps) {
  return (
    <section id="care-around-me" className="bg-slate-100/70 p-5 sm:p-6 rounded-3xl border border-slate-500/20 shadow-sm scroll-mt-4">
      <div className="border-b border-sand-100 pb-3 mb-4">
        <h3 className="serif text-lg sm:text-xl text-sand-900 font-semibold">🏡 Care Around Me</h3>
        <p className="text-xs text-sand-800/60">My space, my messages, my people.</p>
      </div>
      <div className="divide-y divide-sand-100">
        <CareRow
          icon="🧹"
          title="Care for Space"
          description="5 minutes to restore calm to your primary desk or surface."
          doneLabel="Reset Done ✓"
          buttonLabel={spaceDone ? 'Do Another 5-Min Reset' : 'Start 5-Minute Room Reset'}
          buttonIcon="⏱️"
          isDone={spaceDone}
          buttonClassName="bg-sand-100 hover:bg-sand-200/70 text-sand-900"
          onOpen={onOpenSpace}
        />
        <CareRow
          icon="💬"
          title="Digital: Message Reset"
          description="Nightly manual check to handle outstanding messages so your mind rests easy."
          doneLabel="Cleared ✓"
          buttonLabel="Open Nightly Message Check"
          buttonIcon="🌙"
          isDone={messagesDone}
          buttonClassName="bg-slate-100 hover:bg-slate-200/80 text-slate-800"
          onOpen={onOpenMessages}
        />
        <CareRow
          icon="💛"
          title="People: Relationship Connection"
          description="A gentle reminder to intentionally reach out to someone you care about."
          doneLabel="Connected ✓"
          buttonLabel="View Connection Reminders & Ideas"
          buttonIcon="✨"
          isDone={peopleDone}
          buttonClassName="bg-terracotta-100/60 hover:bg-terracotta-100 text-terracotta-600"
          onOpen={onOpenPeople}
        />
      </div>
    </section>
  );
}
