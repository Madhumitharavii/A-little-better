import { useEffect, useState } from 'react';
import { formatDisplayDate } from '@/shared/utils/formatDate';
import {
  describeSource,
  getConnectedAccounts,
  goodreadsIdFrom,
  letterboxdUserFrom,
  setConnectedAccounts,
  syncFeeds,
  useLastFeedSync,
} from '@/lib/feedSync';

/**
 * Settings → Connected accounts: keep logging on Letterboxd and Goodreads, and
 * new entries show up here by themselves. One way, from your public feeds.
 */
export default function ConnectedAccountsSection({ showToast }: { showToast: (msg: string) => void }) {
  const [letterboxd, setLetterboxd] = useState('');
  const [goodreads, setGoodreads] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const last = useLastFeedSync();

  useEffect(() => {
    void getConnectedAccounts().then((a) => {
      setLetterboxd(a.letterboxd ?? '');
      setGoodreads(a.goodreadsId ?? '');
      setLoaded(true);
    });
  }, []);

  const lbUser = letterboxd.trim() ? letterboxdUserFrom(letterboxd) : undefined;
  const grId = goodreads.trim() ? goodreadsIdFrom(goodreads) : undefined;
  const lbInvalid = !!letterboxd.trim() && !lbUser;
  const grInvalid = !!goodreads.trim() && !grId;

  const saveAndCheck = async () => {
    if (lbInvalid || grInvalid) return;
    setBusy(true);
    await setConnectedAccounts({ letterboxd: lbUser, goodreadsId: grId });
    const result = await syncFeeds();
    setBusy(false);
    if (!result) showToast('Accounts cleared.');
    else showToast([describeSource('Letterboxd', result.letterboxd), describeSource('Goodreads', result.goodreads)].filter(Boolean).join(' · '));
  };

  const time = last ? `${formatDisplayDate(last.at.slice(0, 10))} ${new Date(last.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '';

  return (
    <div className="p-3 bg-sage-100/50 rounded-2xl border border-sage-300/60 space-y-3">
      <div>
        <p className="font-semibold text-sand-900 text-xs">🔗 Connected accounts</p>
        <p className="text-[11px] text-sand-800/60 mt-0.5 leading-relaxed">
          Keep logging on Letterboxd and Goodreads — new films and books (with ratings, reviews and likes) appear in Life by
          themselves. One way only, from your public profiles; checked when you open the app and every few hours.
        </p>
      </div>

      <label className="block text-[11px]">
        <span className="font-semibold text-sand-900">Letterboxd username</span>
        <input
          value={letterboxd}
          onChange={(e) => setLetterboxd(e.target.value)}
          placeholder="your username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="mt-1 w-full p-2.5 bg-sand-50 border border-sand-200 rounded-xl text-xs text-sand-900 focus:outline-none"
        />
        {lbInvalid && <span className="text-terracotta-600">Just the username, e.g. the part after letterboxd.com/</span>}
      </label>

      <label className="block text-[11px]">
        <span className="font-semibold text-sand-900">Goodreads profile link</span>
        <input
          value={goodreads}
          onChange={(e) => setGoodreads(e.target.value)}
          placeholder="goodreads.com/user/show/12345678-…"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="mt-1 w-full p-2.5 bg-sand-50 border border-sand-200 rounded-xl text-xs text-sand-900 focus:outline-none"
        />
        {grInvalid && <span className="text-terracotta-600">Paste your profile link (it has a number in it), or just the number.</span>}
      </label>

      <button
        onClick={saveAndCheck}
        disabled={!loaded || busy || lbInvalid || grInvalid}
        className="w-full py-2.5 bg-sand-900 text-white rounded-xl font-semibold text-xs disabled:opacity-50"
      >
        {busy ? 'Checking…' : 'Save & check now'}
      </button>

      {last && (
        <div className="text-[11px] text-sand-800/70 space-y-0.5">
          <p className="text-sand-800/50">Last checked {time}</p>
          {[describeSource('Letterboxd', last.letterboxd), describeSource('Goodreads', last.goodreads)].filter(Boolean).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}
