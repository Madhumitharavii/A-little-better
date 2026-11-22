/** Lets any screen ask the app to open a Life item (switches to the Life tab and opens it). */
const OPEN_LIFE_ITEM = 'alb:open-life-item';

export function openLifeItem(id: string): void {
  window.dispatchEvent(new CustomEvent<string>(OPEN_LIFE_ITEM, { detail: id }));
}

export function onOpenLifeItem(handler: (id: string) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<string>).detail);
  window.addEventListener(OPEN_LIFE_ITEM, listener);
  return () => window.removeEventListener(OPEN_LIFE_ITEM, listener);
}
