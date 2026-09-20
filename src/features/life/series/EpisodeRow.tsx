import { useState } from 'react';
import StarRating from '@/shared/components/StarRating';
import type { Episode } from '@/db/schema';

interface EpisodeRowProps {
  episode: Episode;
  onToggleWatched: () => void;
  onToggleFavorite: () => void;
  onSetRating: (rating: number | undefined) => void;
  onRewatch: () => void;
  onRename: (title: string | undefined) => void;
  onDelete: () => void;
}

export default function EpisodeRow({
  episode,
  onToggleWatched,
  onToggleFavorite,
  onSetRating,
  onRewatch,
  onRename,
  onDelete,
}: EpisodeRowProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(episode.title ?? '');

  const saveTitle = () => {
    onRename(titleDraft.trim() || undefined);
    setEditingTitle(false);
  };

  return (
    <div className={`p-2.5 rounded-xl border transition-colors ${episode.watched ? 'bg-sage-100/40 border-sage-300' : 'bg-sand-50 border-sand-200'}`}>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleWatched}
          aria-label={episode.watched ? 'Mark unwatched' : 'Mark watched'}
          className={`w-6 h-6 shrink-0 rounded-full border flex items-center justify-center text-[10px] ${
            episode.watched ? 'bg-sage-500 border-sage-500 text-white' : 'border-sand-300 bg-white'
          }`}
        >
          {episode.watched ? '✓' : ''}
        </button>

        <span className="text-[11px] font-semibold text-sand-800/60 shrink-0">Ep {episode.number}</span>

        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
            placeholder="Episode title (optional)"
            className="flex-1 min-w-0 text-xs p-1 bg-white border border-sand-300 rounded-lg"
          />
        ) : (
          <button onClick={() => setEditingTitle(true)} className="flex-1 min-w-0 text-left text-xs text-sand-900 truncate">
            {episode.title || <span className="text-sand-800/40">Untitled — tap to name</span>}
          </button>
        )}

        <button onClick={onDelete} aria-label="Delete episode" className="text-sand-800/40 hover:text-terracotta-600 text-[11px] shrink-0 px-1">
          ✕
        </button>
      </div>

      <div className="flex items-center gap-3 mt-1.5 pl-8 flex-wrap">
        <button onClick={onToggleFavorite} aria-label="Favorite episode" className={`text-sm ${episode.favorite ? 'text-terracotta-400' : 'text-sand-300'}`}>
          {episode.favorite ? '❤️' : '🤍'}
        </button>
        <StarRating value={episode.rating} onChange={onSetRating} size="sm" />
        <button
          onClick={onRewatch}
          className="text-[10px] bg-white hover:bg-sand-100 border border-sand-200 text-sand-800 px-2 py-1 rounded-lg shrink-0"
        >
          🔁 Rewatch{episode.rewatchCount ? ` (${episode.rewatchCount})` : ''}
        </button>
      </div>
    </div>
  );
}
