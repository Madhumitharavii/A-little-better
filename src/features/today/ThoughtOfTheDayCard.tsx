import { thoughtForDate } from './dailyThoughts';

/** Today's thought, in its own small card under the greeting. A new one each day — see dailyThoughts.ts. */
export default function ThoughtOfTheDayCard() {
  return (
    <section className="bg-terracotta-100/50 px-5 py-5 sm:px-8 sm:py-6 rounded-3xl border border-terracotta-400/20 text-center">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-terracotta-600 mb-1">💭 Thought of the Day</p>
      <p className="serif italic text-base sm:text-lg text-sand-900">"{thoughtForDate()}"</p>
    </section>
  );
}
