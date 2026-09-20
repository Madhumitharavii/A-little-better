import type { BookItem } from '@/db/schema';
import { useLifeImageUrl } from '@/shared/hooks/useLifeImageUrl';
import StarRating from '@/shared/components/StarRating';

const STATUS_LABEL: Record<NonNullable<BookItem['status']>, string> = {
  wantTo: 'Want to Read',
  inProgress: 'Reading',
  finished: 'Finished',
  didNotFinish: 'Did Not Finish',
};

export default function BookCard({ book, onClick }: { book: BookItem; onClick: () => void }) {
  const coverUrl = useLifeImageUrl(book.coverImageId);

  return (
    <button
      onClick={onClick}
      className="text-left bg-white rounded-3xl border border-sand-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex gap-3 p-3"
    >
      <div className="w-16 h-24 shrink-0 rounded-xl overflow-hidden bg-sand-100 flex items-center justify-center">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="w-full h-full object-cover" />
        ) : book.coverUrl ? (
          <img src={book.coverUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl">📖</span>
        )}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="serif text-sm font-semibold text-sand-900 truncate">{book.title}</p>
        {book.author && <p className="text-[11px] text-sand-800/60 truncate">{book.author}</p>}
        {book.status && (
          <span className="inline-block mt-1.5 text-[10px] bg-sand-100 text-sand-800/80 px-2 py-0.5 rounded-full font-medium">
            {STATUS_LABEL[book.status]}
          </span>
        )}
        {!!book.rating && (
          <div className="mt-1.5">
            <StarRating value={book.rating} size="sm" />
          </div>
        )}
      </div>
      {book.favorite && <span className="text-terracotta-400 text-sm self-start">♥</span>}
    </button>
  );
}
