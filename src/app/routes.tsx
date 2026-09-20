export type TabId = 'today' | 'week' | 'life' | 'journal' | 'me';

export interface TabDef {
  id: TabId;
  label: string;
  implemented: boolean;
}

// LIFE and WEEK are now implemented.
export const TABS: TabDef[] = [
  { id: 'today', label: 'Today', implemented: true },
  { id: 'week', label: 'Week', implemented: true },
  { id: 'life', label: 'Life', implemented: true },
  { id: 'journal', label: 'Journal', implemented: true },
  { id: 'me', label: 'Me', implemented: true },
];
