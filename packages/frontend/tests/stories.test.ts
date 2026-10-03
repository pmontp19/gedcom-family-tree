// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createStory } from '@gedcom/shared/story';
import { loadStories, saveStory, deleteStory, parseStory, slugify } from '@/services/stories';

const story = () => createStory({
  title: 'Del Pla a Barcelona',
  rootId: 'I1',
  steps: [{ title: 'Neix', body: 'Text', stage: { kind: 'tree', focusId: 'I1' } }],
});

describe('story storage', () => {
  beforeEach(() => localStorage.clear());

  it('keeps stories per tree, newest first, replacing by id', () => {
    const a = story();
    const b = story();
    saveStory('a.ged', a);
    saveStory('a.ged', b);
    saveStory('a.ged', { ...a, title: 'Nou títol' });
    expect(loadStories('a.ged').map(s => s.title)).toEqual(['Nou títol', 'Del Pla a Barcelona']);
    expect(loadStories('b.ged')).toEqual([]);
    expect(deleteStory('a.ged', a.id).map(s => s.id)).toEqual([b.id]);
  });

  it('drops stored entries that no longer validate', () => {
    localStorage.setItem('stories:a.ged', JSON.stringify([{ title: 'trencada' }, story()]));
    expect(loadStories('a.ged')).toHaveLength(1);
  });

  it('round-trips an exported file and rejects anything else', () => {
    const s = story();
    expect(parseStory(JSON.stringify(s))).toEqual(s);
    expect(() => parseStory('{"title":"x"}')).toThrow();
  });

  it('slugifies Catalan titles for file names', () => {
    expect(slugify("Del Pla d'Urgell a Barcelona")).toBe('del-pla-d-urgell-a-barcelona');
  });
});
