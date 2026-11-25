import { useMemo } from 'react';
import { useLifeRows } from '@/db/lifeStore';
import { lettersFrom } from './letters';

export function useLetters() {
  const rows = useLifeRows();
  return useMemo(() => lettersFrom(rows), [rows]);
}
