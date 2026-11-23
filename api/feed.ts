/**
 * A tiny relay for your own public Letterboxd / Goodreads feeds.
 *
 * Browsers won't let the app read another site's feed directly (CORS), so the
 * app asks this function — running on your own Vercel project — which fetches
 * the feed and hands it back. It can ONLY fetch these two feed addresses, built
 * from a username / number, so it can't be used to fetch anything else.
 * Nothing is stored or logged here.
 *
 *   /api/feed?source=letterboxd&user=<username>
 *   /api/feed?source=goodreads&user=<user number>&shelf=read|currently-reading|to-read[&key=<rss key>]
 *   /api/feed?source=letterboxd-poster&uri=<a film's Letterboxd link>
 *     → {"poster": "<poster image link>" | null} — looked up from that film's
 *       public page; only letterboxd.com / boxd.it film links are accepted.
 *
 * Goodreads profiles visible only to members need the private `key` from the
 * RSS link on your My Books page; it's passed through to Goodreads, never stored.
 */
export const config = { runtime: 'edge' };

const SHELVES = new Set(['read', 'currently-reading', 'to-read']);

export function feedUrl(params: URLSearchParams): string | null {
  const source = params.get('source');
  const user = params.get('user') ?? '';
  if (source === 'letterboxd' && /^[A-Za-z0-9_]{1,40}$/.test(user)) return `https://letterboxd.com/${user}/rss/`;
  if (source === 'goodreads' && /^\d{1,12}$/.test(user)) {
    const shelf = params.get('shelf') ?? 'read';
    if (!SHELVES.has(shelf)) return null;
    const key = params.get('key');
    if (key !== null && !/^[A-Za-z0-9_-]{6,100}$/.test(key)) return null;
    return `https://www.goodreads.com/review/list_rss/${user}?shelf=${shelf}&per_page=100${key ? `&key=${key}` : ''}`;
  }
  return null;
}

/** A film's public page from a link the app stored: boxd.it short links, or letterboxd.com film / diary links. */
export function filmPageUrl(uri: string | null): string | null {
  if (!uri) return null;
  if (/^https:\/\/boxd\.it\/[A-Za-z0-9]{1,16}$/.test(uri)) return uri;
  const m = uri.match(/^https:\/\/letterboxd\.com\/(?:[A-Za-z0-9_]{1,40}\/)?film\/([a-z0-9-]{1,150})\/(?:\d+\/)?$/);
  return m ? `https://letterboxd.com/film/${m[1]}/` : null;
}

const POSTER_SIZE = '-0-230-0-345-crop';

/** The poster link in a film page (its structured data), at card size. Only Letterboxd's own image host. */
export function posterFromPage(html: string): string | null {
  const m = html.match(/"image"\s*:\s*"(https:\/\/a\.ltrbxd\.com\/resized\/[^"]+)"/);
  return m ? m[1].replace(/-0-\d+-0-\d+-crop/, POSTER_SIZE) : null;
}

const UA = { 'User-Agent': 'ALittleBetter/1.0 (personal feed reader)' };
const json = (body: unknown, status = 200, cache = 'no-store') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': cache } });

async function posterLookup(uri: string | null): Promise<Response> {
  let page = filmPageUrl(uri);
  if (!page) return new Response('Unknown film link', { status: 400 });
  try {
    let res = await fetch(page, { headers: UA, redirect: 'follow' });
    // A short link may land on a diary entry (letterboxd.com/<user>/film/<slug>/…) — use the film's own page.
    const landed = filmPageUrl(new URL(res.url).origin + new URL(res.url).pathname);
    if (res.ok && landed && landed !== res.url && new URL(res.url).hostname === 'letterboxd.com') {
      page = landed;
      res = await fetch(page, { headers: UA, redirect: 'follow' });
    }
    if (res.status === 404) return json({ poster: null }, 200, 'public, s-maxage=604800');
    if (!res.ok) return json({ error: res.status }, 502);
    if (new URL(res.url).hostname !== 'letterboxd.com') return json({ poster: null });
    // Posters rarely change: let Vercel's cache answer repeat lookups for a month.
    return json({ poster: posterFromPage(await res.text()) }, 200, 'public, s-maxage=2592000');
  } catch {
    return json({ error: 'unreachable' }, 502);
  }
}

export default async function handler(req: Request): Promise<Response> {
  const params = new URL(req.url).searchParams;
  if (params.get('source') === 'letterboxd-poster') return posterLookup(params.get('uri'));
  const target = feedUrl(params);
  if (!target) return new Response('Unknown feed', { status: 400 });
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: { 'User-Agent': 'ALittleBetter/1.0 (personal feed reader)', Accept: 'application/rss+xml, application/xml;q=0.9' },
      redirect: 'follow',
    });
  } catch {
    return new Response('Feed could not be reached', { status: 502 });
  }
  if (!upstream.ok) return new Response(`Feed answered ${upstream.status}`, { status: upstream.status === 404 ? 404 : 502 });
  return new Response(await upstream.text(), {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'no-store' },
  });
}
