import type { SeriesItem } from '@/db/schema';
import { useLifeImageUrl } from '@/shared/hooks/useLifeImageUrl';
import StarRating from '@/shared/components/StarRating';
import { getEpisodeStats } from './episodeHelpers';

const STATUS_LABEL: Record<NonNullable<SeriesItem['status']>, string> = {
  wantTo: 'Want to Watch',
  watching: 'Watching',
  finished: 'Finished',
  didNotFinish: 'Did Not Finish',
};

export default function SeriesCard({ series, onClick }: { series: SeriesItem; onClick: () => void }) {
  const posterUrl = useLifeImageUrl(series.posterImageId);
  const episodeStats = getEpisodeStats(series.seasons);

  return (
    <button
      onClick={onClick}
      className="text-left bg-white rounded-3xl border border-sand-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex gap-3 p-3"
    >
      <div className="w-16 h-24 shrink-0 rounded-xl overflow-hidden bg-sand-100 flex items-center justify-center">
        {posterUrl ? (
          <img src={posterUrl} alt="" className="w-full h-full object-cover" />
        ) : series.posterUrl ? (
          <img src={series.posterUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl">📺</span>
        )}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="serif text-sm font-semibold text-sand-900 truncate">{series.title}</p>
        {series.status && (
          <span className="inline-block mt-1 text-[10px] bg-sand-100 text-sand-800/80 px-2 py-0.5 rounded-full font-medium">
            {STATUS_LABEL[series.status]}
          </span>
        )}
        {!!series.rating && (
          <div className="mt-1.5">
            <StarRating value={Math.round(series.rating)} size="sm" />
          </div>
        )}
        {episodeStats.totalEpisodes > 0 && (
          <p className="text-[10px] text-sand-800/50 mt-1">
            {episodeStats.watchedEpisodes}/{episodeStats.totalEpisodes} episodes
          </p>
        )}
      </div>
      {series.favorite && <span className="text-terracotta-400 text-sm self-start">♥</span>}
    </button>
  );
}
