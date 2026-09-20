import type { Season, Episode } from '@/db/schema';
import { generateId } from '@/db/id';
import { getLocalDateKey } from '@/db/dateUtils';

/** Adds a new season, numbered one after the highest existing season. */
export function addSeason(seasons: Season[], title?: string): Season[] {
  const nextNumber = seasons.length > 0 ? Math.max(...seasons.map((s) => s.number)) + 1 : 1;
  const newSeason: Season = { id: generateId(), number: nextNumber, title, episodes: [] };
  return [...seasons, newSeason];
}

export function deleteSeason(seasons: Season[], seasonId: string): Season[] {
  return seasons.filter((s) => s.id !== seasonId);
}

export function renameSeason(seasons: Season[], seasonId: string, title: string | undefined): Season[] {
  return seasons.map((s) => (s.id === seasonId ? { ...s, title } : s));
}

export function setSeasonRating(seasons: Season[], seasonId: string, rating: number | undefined): Season[] {
  return seasons.map((s) => (s.id === seasonId ? { ...s, rating } : s));
}

/** Adds a new episode to a season, numbered one after its highest existing episode. */
export function addEpisode(seasons: Season[], seasonId: string, title?: string): Season[] {
  return seasons.map((s) => {
    if (s.id !== seasonId) return s;
    const nextNumber = s.episodes.length > 0 ? Math.max(...s.episodes.map((e) => e.number)) + 1 : 1;
    const newEpisode: Episode = { id: generateId(), number: nextNumber, title };
    return { ...s, episodes: [...s.episodes, newEpisode] };
  });
}

export function deleteEpisode(seasons: Season[], seasonId: string, episodeId: string): Season[] {
  return seasons.map((s) => (s.id === seasonId ? { ...s, episodes: s.episodes.filter((e) => e.id !== episodeId) } : s));
}

function updateEpisode(seasons: Season[], seasonId: string, episodeId: string, patch: Partial<Episode>): Season[] {
  return seasons.map((s) => {
    if (s.id !== seasonId) return s;
    return { ...s, episodes: s.episodes.map((e) => (e.id === episodeId ? { ...e, ...patch } : e)) };
  });
}

export function toggleEpisodeWatched(seasons: Season[], seasonId: string, episodeId: string): Season[] {
  const season = seasons.find((s) => s.id === seasonId);
  const episode = season?.episodes.find((e) => e.id === episodeId);
  const nowWatched = !episode?.watched;
  return updateEpisode(seasons, seasonId, episodeId, {
    watched: nowWatched,
    dateWatched: nowWatched ? getLocalDateKey() : undefined,
  });
}

export function toggleEpisodeFavorite(seasons: Season[], seasonId: string, episodeId: string): Season[] {
  const season = seasons.find((s) => s.id === seasonId);
  const episode = season?.episodes.find((e) => e.id === episodeId);
  return updateEpisode(seasons, seasonId, episodeId, { favorite: !episode?.favorite });
}

export function setEpisodeRating(seasons: Season[], seasonId: string, episodeId: string, rating: number | undefined): Season[] {
  return updateEpisode(seasons, seasonId, episodeId, { rating });
}

export function renameEpisode(seasons: Season[], seasonId: string, episodeId: string, title: string | undefined): Season[] {
  return updateEpisode(seasons, seasonId, episodeId, { title });
}

/** Logs a rewatch: marks the episode watched (if it wasn't already) and increments its rewatch count. */
export function logEpisodeRewatch(seasons: Season[], seasonId: string, episodeId: string): Season[] {
  const season = seasons.find((s) => s.id === seasonId);
  const episode = season?.episodes.find((e) => e.id === episodeId);
  const currentCount = episode?.rewatchCount ?? 0;
  return updateEpisode(seasons, seasonId, episodeId, {
    watched: true,
    dateWatched: getLocalDateKey(),
    rewatchCount: currentCount + 1,
  });
}

export interface EpisodeStats {
  totalEpisodes: number;
  watchedEpisodes: number;
}

export function getEpisodeStats(seasons: Season[] | undefined): EpisodeStats {
  if (!seasons) return { totalEpisodes: 0, watchedEpisodes: 0 };
  let total = 0;
  let watched = 0;
  for (const season of seasons) {
    for (const episode of season.episodes) {
      total++;
      if (episode.watched) watched++;
    }
  }
  return { totalEpisodes: total, watchedEpisodes: watched };
}

export interface FavoriteEpisodeRef {
  seasonId: string;
  seasonNumber: number;
  episode: Episode;
}

export function getFavoriteEpisodes(seasons: Season[] | undefined): FavoriteEpisodeRef[] {
  if (!seasons) return [];
  const favorites: FavoriteEpisodeRef[] = [];
  for (const season of seasons) {
    for (const episode of season.episodes) {
      if (episode.favorite) favorites.push({ seasonId: season.id, seasonNumber: season.number, episode });
    }
  }
  return favorites;
}
