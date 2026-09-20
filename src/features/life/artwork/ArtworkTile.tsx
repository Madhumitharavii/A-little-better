import type { ArtworkItem } from '@/db/schema';
import { useLifeImageUrl } from '@/shared/hooks/useLifeImageUrl';

export default function ArtworkTile({ artwork, onClick }: { artwork: ArtworkItem; onClick: () => void }) {
  const imageUrl = useLifeImageUrl(artwork.imageId);

  return (
    <button
      onClick={onClick}
      className="relative aspect-square rounded-2xl overflow-hidden bg-sand-100 border border-sand-200 shadow-sm hover:shadow-md transition-all group"
    >
      {imageUrl ? (
        <img src={imageUrl} alt={artwork.title || ''} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-3xl">🎨</div>
      )}
      {artwork.favorite && (
        <span className="absolute top-2 right-2 text-terracotta-400 text-sm drop-shadow">♥</span>
      )}
      {artwork.title && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-sand-900/70 to-transparent px-2.5 py-2">
          <p className="text-white text-[11px] font-medium truncate">{artwork.title}</p>
        </div>
      )}
    </button>
  );
}
