import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import StarRating from '@/shared/components/StarRating';
import ConfirmInline from '@/shared/components/ConfirmInline';
import EpisodeRow from './EpisodeRow';
import { updateLifeItem } from '@/db/repositories/lifeRepository';
import type { SeriesItem, Season } from '@/db/schema';
import {
  addSeason,
  deleteSeason,
  renameSeason,
  setSeasonRating,
  addEpisode,
  deleteEpisode,
  toggleEpisodeWatched,
  toggleEpisodeFavorite,
  setEpisodeRating,
  renameEpisode,
  logEpisodeRewatch,
  getEpisodeStats,
  getFavoriteEpisodes,
} from './episodeHelpers';

interface SeasonsManagerModalProps {
  series: SeriesItem;
  onClose: () => void;
  showToast: (msg: string) => void;
}

function SeasonTitle({ season, onRename }: { season: Season; onRename: (title: string | undefined) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(season.title ?? '');

  const save = () => {
    onRename(draft.trim() || undefined);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        placeholder={'Season ' + season.number}
        className="flex-1 min-w-0 text-xs font-semibold p-1 bg-white border border-sand-300 rounded-lg"
      />
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="flex-1 min-w-0 text-left text-xs font-semibold text-sand-900 truncate">
      {'Season ' + season.number + (season.title ? ' — ' + season.title : '')}
    </button>
  );
}

export default function SeasonsManagerModal({ series, onClose, showToast }: SeasonsManagerModalProps) {
  const [seasons, setSeasons] = useState<Season[]>(series.seasons ?? []);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [confirmDeleteSeasonId, setConfirmDeleteSeasonId] = useState<string | null>(null);

  const stats = getEpisodeStats(seasons);
  const favorites = getFavoriteEpisodes(seasons);

  const persist = async (next: Season[]) => {
    setSeasons(next);
    await updateLifeItem(series.id, { type: 'series', seasons: next });
  };

  const toggleCollapsed = (seasonId: string) => setCollapsed((prev) => ({ ...prev, [seasonId]: !prev[seasonId] }));

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="🗂️" title={series.title + ' — Episodes'} onClose={onClose} />

      {stats.totalEpisodes > 0 && (
        <div className="p-3 bg-sand-50 border border-sand-200 rounded-2xl text-xs text-sand-800/80">
          {stats.watchedEpisodes} of {stats.totalEpisodes} episodes watched
        </div>
      )}

      {favorites.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-sand-800/60 flex items-center gap-1.5">
            <span>❤️</span> Favorite Episodes
          </p>
          <div className="flex flex-wrap gap-1.5">
            {favorites.map((fav) => (
              <span key={fav.seasonId + '-' + fav.episode.id} className="text-[11px] bg-terracotta-100 text-terracotta-600 px-2.5 py-1 rounded-full">
                {'S' + fav.seasonNumber + 'E' + fav.episode.number + (fav.episode.title ? ' — ' + fav.episode.title : '')}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {seasons.map((season) => {
          const seasonStats = getEpisodeStats([season]);
          const isCollapsed = collapsed[season.id];
          return (
            <div key={season.id} className="border border-sand-200 rounded-2xl p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <button onClick={() => toggleCollapsed(season.id)} className="text-sand-800/60 text-xs shrink-0">
                  {isCollapsed ? '▸' : '▾'}
                </button>
                <SeasonTitle season={season} onRename={(title) => persist(renameSeason(seasons, season.id, title))} />
                <span className="text-[10px] font-semibold text-sage-700 bg-sage-100 px-2 py-0.5 rounded-full shrink-0">
                  {seasonStats.watchedEpisodes}/{seasonStats.totalEpisodes}
                </span>
                <button
                  onClick={() => setConfirmDeleteSeasonId(season.id)}
                  aria-label="Delete season"
                  className="text-sand-800/40 hover:text-terracotta-600 text-[11px] shrink-0 px-1"
                >
                  ✕
                </button>
              </div>

              <div className="flex items-center gap-2 pl-5">
                <span className="text-[10px] text-sand-800/50">Season rating:</span>
                <StarRating value={season.rating} onChange={(r) => persist(setSeasonRating(seasons, season.id, r))} size="sm" />
              </div>

              {!isCollapsed && (
                <div className="space-y-1.5 pl-5">
                  {season.episodes.map((episode) => (
                    <EpisodeRow
                      key={episode.id}
                      episode={episode}
                      onToggleWatched={() => persist(toggleEpisodeWatched(seasons, season.id, episode.id))}
                      onToggleFavorite={() => persist(toggleEpisodeFavorite(seasons, season.id, episode.id))}
                      onSetRating={(r) => persist(setEpisodeRating(seasons, season.id, episode.id, r))}
                      onRewatch={async () => {
                        await persist(logEpisodeRewatch(seasons, season.id, episode.id));
                        showToast('Rewatch logged 🔁');
                      }}
                      onRename={(title) => persist(renameEpisode(seasons, season.id, episode.id, title))}
                      onDelete={() => persist(deleteEpisode(seasons, season.id, episode.id))}
                    />
                  ))}
                  <button
                    onClick={() => persist(addEpisode(seasons, season.id))}
                    className="w-full py-2 bg-sand-100 hover:bg-sand-200 text-sand-800 text-[11px] font-semibold rounded-xl"
                  >
                    + Add Episode
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={async () => {
          await persist(addSeason(seasons));
          showToast('Season added');
        }}
        className="w-full py-2.5 bg-terracotta-400 hover:bg-terracotta-600 text-white text-xs font-semibold rounded-2xl shadow-sm"
      >
        + Add Season
      </button>

      {confirmDeleteSeasonId && (
        <ConfirmInline
          title="Delete this season and all its episodes?"
          onConfirm={() => {
            persist(deleteSeason(seasons, confirmDeleteSeasonId));
            setConfirmDeleteSeasonId(null);
          }}
          onCancel={() => setConfirmDeleteSeasonId(null)}
        />
      )}
    </Modal>
  );
}
