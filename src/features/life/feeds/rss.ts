/**
 * A tiny RSS reader for the Letterboxd and Goodreads feeds — just enough to
 * pull each <item>'s fields (including namespaced ones like letterboxd:watchedDate
 * and CDATA sections). Pure, and works without a browser (so it's tested).
 */
export type RssItem = Record<string, string>;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITIES[e.toLowerCase()] ?? m;
  });

/** Items as { fieldName: text }, where "letterboxd:watchedDate" is stored as "watchedDate". */
export function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  for (const [, body] of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g)) {
    const item: RssItem = {};
    for (const [, tag, , inner] of body.matchAll(/<([A-Za-z_][\w.-]*(?::[\w.-]+)?)(\s[^>]*)?>([\s\S]*?)<\/\1>/g)) {
      const name = tag.includes(':') ? tag.split(':')[1] : tag;
      const cdata = inner.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
      item[name] = cdata ? cdata[1] : decode(inner.trim());
    }
    items.push(item);
  }
  return items;
}
