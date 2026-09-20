import type { MovieItem } from '@/db/schema';
import { useLifeImageUrl } from '@/shared/hooks/useLifeImageUrl';
import { formatDisplayDate } from '@/shared/utils/formatDate';
import StarRating from '@/shared/components/StarRating';

export default function MovieCard({ movie, onClick }: { movie: MovieItem; onClick: () => void }) {
  const posterUrl = useLifeImageUrl(movie.posterImageId);

  return (
    <button
      onClick={onClick}
      className="text-left bg-white rounded-3xl border border-sand-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex gap-3 p-3"
    >
      <div className="w-16 h-24 shrink-0 rounded-xl overflow-hidden bg-sand-100 flex items-center justify-center">
        {posterUrl ? (
          <img src={posterUrl} alt="" className="w-full h-full object-cover" />
        ) : movie.posterUrl ? (
          <img src={movie.posterUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl">🎬</span>
        )}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="serif text-sm font-semibold text-sand-900 truncate">{movie.title}</p>
        <p className="text-[11px] text-sand-800/60">
          {movie.year} {movie.dateWatched ? `· watched ${formatDisplayDate(movie.dateWatched)}` : ''}
        </p>
        {!!movie.rating && (
          <div className="mt-1.5">
            <StarRating value={Math.round(movie.rating)} size="sm" />
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-1">
          {movie.rewatch && <span className="text-[10px] bg-sand-100 text-sand-800/80 px-2 py-0.5 rounded-full">Rewatch</span>}
          {movie.status === 'didNotFinish' && (
            <span className="text-[10px] bg-sand-200 text-sand-800 px-2 py-0.5 rounded-full">Did Not Finish</span>
          )}
          {movie.source === 'letterboxd' && (
            <span className="text-[10px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded-full">Letterboxd</span>
          )}
        </div>
      </div>
      {movie.favorite && <span className="text-terracotta-400 text-sm self-start">♥</span>}
    </button>
  );
}
