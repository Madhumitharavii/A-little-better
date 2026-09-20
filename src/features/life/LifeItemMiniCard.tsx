import type { LifeItem } from '@/db/schema';
import { useLifeImageUrl } from '@/shared/hooks/useLifeImageUrl';

const TYPE_META: Record<LifeItem['type'], { icon: string; label: string }> = {
  book: { icon: '📖', label: 'Book' },
  movie: { icon: '🎬', label: 'Movie' },
  series: { icon: '📺', label: 'Series' },
  artwork: { icon: '🎨', label: 'Artwork' },
  experience: { icon: '🌿', label: 'Experience' },
  wish: { icon: '⭐', label: 'Wishlist' },
};

function subtitle(item: LifeItem): string {
  switch (item.type) {
    case 'book':
      return item.author ?? 'Book';
    case 'movie':
      return item.year ? String(item.year) : 'Movie';
    case 'series':
      return 'Series';
    case 'artwork':
      return item.medium ?? 'Artwork';
    case 'experience':
      return item.location ?? 'Experience';
    case 'wish':
      return item.category ?? 'Someday';
  }
}

function imageIdFor(item: LifeItem): string | undefined {
  if (item.type === 'book') return item.coverImageId;
  if (item.type === 'movie') return item.posterImageId;
  if (item.type === 'series') return item.posterImageId;
  if (item.type === 'artwork') return item.imageId;
  if (item.type === 'experience') return item.imageIds?.[0];
  return undefined;
}

interface LifeItemMiniCardProps {
  item: LifeItem;
  onClick: () => void;
}

export default function LifeItemMiniCard({ item, onClick }: LifeItemMiniCardProps) {
  const meta = TYPE_META[item.type];
  const thumbUrl = useLifeImageUrl(imageIdFor(item));

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl border border-sand-200 hover:border-sand-300 shadow-sm transition-colors text-left"
    >
      <div className="w-11 h-11 shrink-0 rounded-xl overflow-hidden bg-sand-100 flex items-center justify-center text-lg">
        {thumbUrl ? <img src={thumbUrl} alt="" className="w-full h-full object-cover" /> : meta.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-sand-900 truncate">{item.title}</p>
        <p className="text-[11px] text-sand-800/60 truncate">
          {meta.label} · {subtitle(item)}
        </p>
      </div>
      {item.favorite && <span className="text-terracotta-400 shrink-0">♥</span>}
    </button>
  );
}
