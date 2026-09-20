import { useState } from 'react';
import type { LifeItem, WishItem } from '@/db/schema';
import { useRecentlyAdded, useLifeCounts, useLifeSearch, useLifeItemsOfType } from './useLifeItems';
import LifeSearchBar from './LifeSearchBar';
import LifeItemMiniCard from './LifeItemMiniCard';
import BooksPage from './books/BooksPage';
import MoviesPage from './movies/MoviesPage';
import SeriesPage from './series/SeriesPage';
import ArtworkPage from './artwork/ArtworkPage';
import ExperiencesPage from './experiences/ExperiencesPage';
import SomedayMaybePage from './wishlist/SomedayMaybePage';
import AnnualVisionPage from './wishlist/AnnualVisionPage';

interface LifePageProps {
  showToast: (msg: string) => void;
}

type LifeView = 'home' | 'book' | 'movie' | 'series' | 'artwork' | 'experience' | 'somedayMaybe' | 'annualVision';

function viewForItem(item: LifeItem): Exclude<LifeView, 'home'> {
  if (item.type === 'wish') {
    return item.listType === 'annualVision' ? 'annualVision' : 'somedayMaybe';
  }
  return item.type;
}

export default function LifePage({ showToast }: LifePageProps) {
  const [view, setView] = useState<LifeView>('home');
  const [openItem, setOpenItem] = useState<LifeItem | null>(null);
  const [query, setQuery] = useState('');

  const recentlyAdded = useRecentlyAdded(6);
  const counts = useLifeCounts();
  const searchResults = useLifeSearch(query);
  const allWishes = useLifeItemsOfType('wish') as WishItem[];
  const somedayMaybeCount = allWishes.filter((w) => (w.listType ?? 'somedayMaybe') === 'somedayMaybe').length;
  const annualVisionCount = allWishes.filter((w) => w.listType === 'annualVision').length;

  const categoryCards = [
    { view: 'book' as const, icon: '📖', title: 'Books', tagline: "What I've read", accent: 'bg-sage-100 border-sage-300', count: counts.book },
    { view: 'movie' as const, icon: '🎬', title: 'Movies', tagline: "What I've watched", accent: 'bg-terracotta-100 border-terracotta-400/40', count: counts.movie },
    { view: 'series' as const, icon: '📺', title: 'Series', tagline: "What I've binged", accent: 'bg-slate-100 border-slate-500/30', count: counts.series },
    { view: 'artwork' as const, icon: '🎨', title: 'Artwork', tagline: "What I've made", accent: 'bg-amber-50 border-amber-300/50', count: counts.artwork },
    { view: 'experience' as const, icon: '🌿', title: 'Experiences', tagline: "What I've lived", accent: 'bg-sand-100 border-sand-300', count: counts.experience },
    { view: 'somedayMaybe' as const, icon: '⭐', title: 'Someday, Maybe', tagline: 'Things to try, someday', accent: 'bg-terracotta-100/60 border-terracotta-300/50', count: somedayMaybeCount },
    { view: 'annualVision' as const, icon: '🎯', title: 'Annual Vision', tagline: "This year's vision board", accent: 'bg-sage-100/70 border-sage-300', count: annualVisionCount },
  ];

  const openFromAnywhere = (item: LifeItem) => {
    setOpenItem(item);
    setView(viewForItem(item));
  };

  if (view !== 'home') {
    const back = () => {
      setView('home');
      setOpenItem(null);
    };
    if (view === 'book') return <BooksPage showToast={showToast} onBack={back} initialOpenItem={openItem?.type === 'book' ? openItem : undefined} />;
    if (view === 'movie') return <MoviesPage showToast={showToast} onBack={back} initialOpenItem={openItem?.type === 'movie' ? openItem : undefined} />;
    if (view === 'series') return <SeriesPage showToast={showToast} onBack={back} initialOpenItem={openItem?.type === 'series' ? openItem : undefined} />;
    if (view === 'artwork') return <ArtworkPage showToast={showToast} onBack={back} initialOpenItem={openItem?.type === 'artwork' ? openItem : undefined} />;
    if (view === 'experience') return <ExperiencesPage showToast={showToast} onBack={back} initialOpenItem={openItem?.type === 'experience' ? openItem : undefined} />;
    if (view === 'somedayMaybe')
      return <SomedayMaybePage showToast={showToast} onBack={back} initialOpenItem={openItem?.type === 'wish' ? openItem : undefined} />;
    if (view === 'annualVision')
      return <AnnualVisionPage showToast={showToast} onBack={back} initialOpenItem={openItem?.type === 'wish' ? openItem : undefined} />;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="text-center sm:text-left">
        <h2 className="serif text-2xl sm:text-3xl font-semibold text-sand-900">Life</h2>
        <p className="text-sm text-sand-800/70 mt-1 italic font-serif">
          The things I've read, watched, made, and lived.
        </p>
      </section>

      <LifeSearchBar value={query} onChange={setQuery} />

      {query.trim() ? (
        <section className="space-y-2">
          {searchResults.length === 0 ? (
            <p className="text-xs text-sand-800/60 text-center py-6">Nothing found yet.</p>
          ) : (
            searchResults.map((item) => <LifeItemMiniCard key={item.id} item={item} onClick={() => openFromAnywhere(item)} />)
          )}
        </section>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:gap-4">
            {categoryCards.map((cat) => (
              <button
                key={cat.view}
                onClick={() => setView(cat.view)}
                className={`p-5 sm:p-6 rounded-3xl border card-transition text-left shadow-sm hover:shadow-md ${cat.accent}`}
              >
                <span className="text-2xl block mb-2">{cat.icon}</span>
                <p className="serif text-lg font-semibold text-sand-900">{cat.title}</p>
                <p className="text-[11px] text-sand-800/60 mt-0.5">{cat.tagline}</p>
                <p className="text-[11px] text-sand-800/50 mt-2">
                  {cat.count} {cat.count === 1 ? 'entry' : 'entries'}
                </p>
              </button>
            ))}
          </section>

          {recentlyAdded.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-sand-800/60">Recently added</h3>
              <div className="space-y-2">
                {recentlyAdded.map((item) => (
                  <LifeItemMiniCard key={item.id} item={item} onClick={() => openFromAnywhere(item)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
