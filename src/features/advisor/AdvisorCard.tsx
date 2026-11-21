import { useEffect, useRef } from 'react';
import { useAdvice } from './useAdvice';
import AdviceList from './AdviceList';

/**
 * "Noticed for You" on Today — gentle advice built from what you've
 * actually logged. Worked out right here on the device: no AI service,
 * no internet, nothing leaves the app. The same advice is also one tap
 * away from any tab via the header's 🧭 Noticed button.
 */
export default function AdvisorCard() {
  const advice = useAdvice();
  const ref = useRef<HTMLElement | null>(null);

  // Scrolling to this card counts as seeing today's advice (clears the header dot).
  useEffect(() => {
    const el = ref.current;
    if (!el || !advice.hasUnseen || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) advice.markSeen();
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [advice]);

  if (!advice.ready) return null;

  return (
    <section ref={ref} id="noticed-for-you" className="bg-amber-50 p-5 sm:p-6 rounded-3xl border border-amber-300/50 shadow-sm space-y-4">
      <div className="border-b border-sand-100 pb-3">
        <h3 className="serif text-lg sm:text-xl text-sand-900 font-semibold">🧭 Noticed for You</h3>
        <p className="text-xs text-sand-800/60">Gentle advice from what you've logged. Worked out privately on this device.</p>
      </div>
      <AdviceList picks={advice.picks} hasAnyData={advice.hasAnyData} onNotHelpful={advice.notHelpful} />
    </section>
  );
}
