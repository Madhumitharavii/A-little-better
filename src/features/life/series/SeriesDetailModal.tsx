import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import StarRating from '@/shared/components/StarRating';
import ConfirmInline from '@/shared/components/ConfirmInline';
import { useLifeImageUrl } from '@/shared/hooks/useLifeImageUrl';
import { formatDisplayDate } from '@/shared/utils/formatDate';
import { getEpisodeStats, getFavoriteEpisodes } from './episodeHelpers';
import SeasonsManagerModal from './SeasonsManagerModal';
import { getLifeItem } from '@/db/repositories/lifeRepository';
import type { SeriesItem } from '@/db/schema';

const STATUS_LABEL: Record<NonNullable<SeriesItem['status']>, string> = {
  wantTo: 'Want to Watch',
  watching: 'Watching',
  finished: 'Finished',
  didNotFinish: 'Did Not Finish',
};

interface SeriesDetailModalProps {
  series: SeriesItem;
  onClose: () => void;
  onEdit: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  showToast: (msg: string) => void;
}

export default function SeriesDetailModal({ series, onClose, onEdit, onToggleFavorite, onDelete, showToast }: SeriesDetailModalProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [managingEpisodes, setManagingEpisodes] = useState(false);

  // Falls back to the prop for the very first render, then stays
  // current after SeasonsManagerModal writes changes — otherwise
  // episode progress/favorites here would go stale until this modal
  // was closed and reopened.
  const liveSeries = useLiveQuery(() => getLifeItem(series.id), [series.id]) as SeriesItem | undefined;
  const current = liveSeries ?? series;

  const posterUrl = useLifeImageUrl(current.posterImageId);
  const episodeStats = getEpisodeStats(current.seasons);
  const favoriteEpisodes = getFavoriteEpisodes(current.seasons);

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="📺" title={current.title} onClose={onClose} />

      <div className="flex gap-4">
        <div className="w-24 h-36 shrink-0 rounded-2xl overflow-hidden bg-sand-100 flex items-center justify-center">
          {posterUrl || current.posterUrl ? (
            <img src={posterUrl ?? current.posterUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl">📺</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          {current.status && (
            <span className="inline-block text-[11px] bg-sand-100 text-sand-800/80 px-2.5 py-0.5 rounded-full font-medium">
              {STATUS_LABEL[current.status]}
            </span>
          )}
          {!!current.rating && <StarRating value={current.rating} size="sm" />}
          {current.favorite && <p className="text-terracotta-600 text-xs">♥ Favorite</p>}
        </div>
      </div>

      {(current.dateStarted || current.dateFinished) && (
        <div className="grid grid-cols-2 gap-3 text-xs">
          {current.dateStarted && (
            <div>
              <p className="font-semibold text-sand-900">Started</p>
              <p className="text-sand-800/70">{formatDisplayDate(current.dateStarted)}</p>
            </div>
          )}
          {current.dateFinished && (
            <div>
              <p className="font-semibold text-sand-900">Finished</p>
              <p className="text-sand-800/70">{formatDisplayDate(current.dateFinished)}</p>
            </div>
          )}
        </div>
      )}

      {current.notes && (
        <div>
          <p className="font-semibold text-sand-900 text-xs mb-1">My thoughts</p>
          <p className="text-xs text-sand-800/80 whitespace-pre-wrap leading-relaxed">{current.notes}</p>
        </div>
      )}

      {episodeStats.totalEpisodes > 0 && (
        <div className="p-3 bg-sand-50 border border-sand-200 rounded-2xl text-xs text-sand-800/80">
          {episodeStats.watchedEpisodes} of {episodeStats.totalEpisodes} episodes watched
        </div>
      )}

      {favoriteEpisodes.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-sand-800/60 flex items-center gap-1.5">
            <span>❤️</span> Favorite Episodes
          </p>
          <div className="flex flex-wrap gap-1.5">
            {favoriteEpisodes.map((fav) => (
              <span key={fav.seasonId + '-' + fav.episode.id} className="text-[11px] bg-terracotta-100 text-terracotta-600 px-2.5 py-1 rounded-full">
                {'S' + fav.seasonNumber + 'E' + fav.episode.number + (fav.episode.title ? ' — ' + fav.episode.title : '')}
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setManagingEpisodes(true)}
        className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-2xl"
      >
        🗂️ Manage Seasons & Episodes
      </button>

      <div className="flex gap-3 pt-2">
        <button onClick={onEdit} className="flex-1 py-2.5 bg-sand-100 hover:bg-sand-200 text-sand-900 text-xs font-semibold rounded-2xl">
          Edit
        </button>
        <button
          onClick={onToggleFavorite}
          className={`flex-1 py-2.5 text-xs font-semibold rounded-2xl transition-colors ${
            current.favorite ? 'bg-terracotta-100 text-terracotta-600' : 'bg-sand-100 hover:bg-sand-200 text-sand-900'
          }`}
        >
          {current.favorite ? '♥ Favorited' : '♡ Favorite'}
        </button>
        <button onClick={() => setConfirmingDelete(true)} className="flex-1 py-2.5 bg-sand-100 hover:bg-terracotta-100 text-sand-900 hover:text-terracotta-600 text-xs font-semibold rounded-2xl">
          Delete
        </button>
      </div>

      {confirmingDelete && (
        <ConfirmInline title="Delete this series?" onConfirm={onDelete} onCancel={() => setConfirmingDelete(false)} />
      )}

      {managingEpisodes && (
        <SeasonsManagerModal series={current} onClose={() => setManagingEpisodes(false)} showToast={showToast} />
      )}
    </Modal>
  );
}
