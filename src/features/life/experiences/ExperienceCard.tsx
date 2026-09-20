import type { ExperienceItem } from '@/db/schema';
import { useLifeImageUrl } from '@/shared/hooks/useLifeImageUrl';
import { formatDisplayDate } from '@/shared/utils/formatDate';
import StarRating from '@/shared/components/StarRating';

export default function ExperienceCard({ experience, onClick }: { experience: ExperienceItem; onClick: () => void }) {
  const thumbUrl = useLifeImageUrl(experience.imageIds?.[0]);

  return (
    <button
      onClick={onClick}
      className="text-left bg-white rounded-3xl border border-sand-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex gap-3 p-3"
    >
      <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-sand-100 flex items-center justify-center">
        {thumbUrl ? <img src={thumbUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl">🌿</span>}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="serif text-sm font-semibold text-sand-900 truncate">{experience.title}</p>
        <p className="text-[11px] text-sand-800/60 truncate">
          {[formatDisplayDate(experience.date), experience.location].filter(Boolean).join(' · ')}
        </p>
        {!!experience.rating && (
          <div className="mt-1">
            <StarRating value={experience.rating} size="sm" />
          </div>
        )}
        {experience.description && <p className="text-[11px] text-sand-800/50 truncate mt-0.5">{experience.description}</p>}
      </div>
      {experience.favorite && <span className="text-terracotta-400 text-sm self-start">♥</span>}
    </button>
  );
}

