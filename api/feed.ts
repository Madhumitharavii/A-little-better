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

export default async function handler(req: Request): Promise<Response> {
  const target = feedUrl(new URL(req.url).searchParams);
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
