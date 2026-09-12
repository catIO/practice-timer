import { describe, it, expect } from 'vitest';
import { slugifyHeader, findSlugInItems, type ReportSnapshotItem } from './reportShare';

describe('slugifyHeader', () => {
  it('converts simple heading titles to lowercase hyphenated slugs', () => {
    expect(slugifyHeader('Repertoire')).toBe('repertoire');
    expect(slugifyHeader('Daily Goals')).toBe('daily-goals');
    expect(slugifyHeader('Technique')).toBe('technique');
    expect(slugifyHeader('Improve accuracy and speed')).toBe('improve-accuracy-and-speed');
  });

  it('strips markdown syntax such as links, bold, italics, and leading hash symbols', () => {
    expect(slugifyHeader('## Repertoire')).toBe('repertoire');
    expect(slugifyHeader('# [Bach Repertoire](https://example.com)')).toBe('bach-repertoire');
    expect(slugifyHeader('**Performance** Practice')).toBe('performance-practice');
    expect(slugifyHeader('*Etude* 24')).toBe('etude-24');
  });

  it('handles punctuation and collapses multiple hyphens and whitespace', () => {
    expect(slugifyHeader('BWV 1005 - Largo')).toBe('bwv-1005-largo');
    expect(slugifyHeader('Warm-Up / Stretch!')).toBe('warm-up-stretch');
    expect(slugifyHeader('   Lots   of    spaces   ')).toBe('lots-of-spaces');
    expect(slugifyHeader('---')).toBe('');
    expect(slugifyHeader('')).toBe('');
  });
});

describe('findSlugInItems', () => {
  const sampleItems: ReportSnapshotItem[] = [
    { text: 'Daily Goals', checked: false, blockType: 'heading2', children: [] },
    {
      text: 'Technique Section',
      checked: false,
      blockType: 'heading1',
      children: [
        { text: 'Scales in C', checked: false, blockType: 'segment', children: [] },
        { text: 'Advanced Arpeggios', checked: false, blockType: 'heading3', children: [] }
      ]
    },
    { text: 'Repertoire', checked: false, blockType: 'heading2', children: [] }
  ];

  it('finds top-level headings by exact slug', () => {
    expect(findSlugInItems(sampleItems, 'repertoire')).toBe(true);
    expect(findSlugInItems(sampleItems, 'daily-goals')).toBe(true);
  });

  it('finds nested child headings', () => {
    expect(findSlugInItems(sampleItems, 'advanced-arpeggios')).toBe(true);
  });

  it('finds headings resiliently even if unhyphenated in search', () => {
    expect(findSlugInItems(sampleItems, 'dailygoals')).toBe(true);
    expect(findSlugInItems(sampleItems, 'advancedarpeggios')).toBe(true);
  });

  it('returns false for non-existent headings or segments', () => {
    expect(findSlugInItems(sampleItems, 'scales-in-c')).toBe(false);
    expect(findSlugInItems(sampleItems, 'non-existent')).toBe(false);
    expect(findSlugInItems([], 'repertoire')).toBe(false);
    expect(findSlugInItems(undefined, 'repertoire')).toBe(false);
  });
});
