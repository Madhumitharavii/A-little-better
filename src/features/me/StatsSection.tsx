import { useStats } from './useStats';
import { useLifeCounts } from '@/features/life/useLifeItems';

const TILE_STYLES = [
  'bg-sage-100 border-sage-300 text-sage-700',
  'bg-terracotta-100 border-terracotta-400/30 text-terracotta-600',
  'bg-slate-100 border-slate-500/20 text-slate-800',
  'bg-amber-50 border-amber-300/50 text-amber-700',
];

interface StatTile {
  icon: string;
  text: string;
}

export default function StatsSection() {
  const stats = useStats();
  const lifeCounts = useLifeCounts();

  const tiles: StatTile[] = [
    { icon: '📖', text: `Read on ${stats.daysReadThisMonth} day${stats.daysReadThisMonth === 1 ? '' : 's'} this month` },
    { icon: '🧹', text: `${stats.roomResetsCompleted} room reset${stats.roomResetsCompleted === 1 ? '' : 's'} in total` },
    { icon: '🔥', text: `Longest reading streak: ${stats.longestReadingStreak} day${stats.longestReadingStreak === 1 ? '' : 's'}` },
    { icon: '🌱', text: `Shown up ${stats.totalDaysShowedUp} day${stats.totalDaysShowedUp === 1 ? '' : 's'} in total` },
  ];
  if (stats.focusMinutesThisMonth > 0) {
    tiles.push({ icon: '🎯', text: `${stats.focusMinutesThisMonth} focus minutes this month` });
  }

  const lifeTotal = lifeCounts.book + lifeCounts.movie + lifeCounts.series + lifeCounts.artwork + lifeCounts.experience;
  if (lifeTotal > 0) {
    tiles.push({
      icon: '📚',
      text: `${lifeCounts.book} books, ${lifeCounts.movie + lifeCounts.series} watches, ${lifeCounts.artwork} artworks, ${lifeCounts.experience} experiences`,
    });
  }

  return (
    <div className="pt-4 border-t border-sand-100">
      <h3 className="serif text-lg font-semibold text-sand-900 mb-1 flex items-center gap-2">
        Patterns &amp; Insights <span className="text-base">✨</span>
      </h3>
      <p className="text-xs text-sand-800/70 mb-4">A record of life, not a performance evaluation.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {tiles.map((tile, i) => (
          <div
            key={tile.text}
            className={`p-3 rounded-2xl border text-xs font-medium flex items-start gap-2 ${TILE_STYLES[i % TILE_STYLES.length]}`}
          >
            <span className="text-base shrink-0">{tile.icon}</span>
            <span>{tile.text}</span>
          </div>
        ))}
      </div>

      {stats.currentShowingUpStreak > 0 && (
        <div className="mt-3 p-3.5 bg-gradient-to-r from-terracotta-100 to-sand-100 border border-terracotta-400/20 rounded-2xl text-xs font-semibold text-sand-900 flex items-center gap-2">
          <span className="text-base">🌟</span>
          <span>
            Right now, you're {stats.currentShowingUpStreak} day{stats.currentShowingUpStreak === 1 ? '' : 's'} into showing up.
          </span>
        </div>
      )}
    </div>
  );
}
