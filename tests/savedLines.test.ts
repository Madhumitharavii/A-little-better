import { describe, expect, it } from 'vitest';
import { toggleLine } from '@/features/ai/savedLines';

describe('lines you loved', () => {
  it('saves newest first, and a second tap removes it', () => {
    let lines = toggleLine([], { text: 'An example line.', date: '2026-11-20' }, 't1');
    lines = toggleLine(lines, { text: 'Another made-up line.', date: '2026-11-21' }, 't2');
    expect(lines.map((l) => l.text)).toEqual(['Another made-up line.', 'An example line.']);
    lines = toggleLine(lines, { text: ' An example line. ', date: '2026-11-20' });
    expect(lines.map((l) => l.text)).toEqual(['Another made-up line.']);
  });
});
