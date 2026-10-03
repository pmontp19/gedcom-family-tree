// Stories live in the browser, per tree: the tree itself never leaves it
// either. Export/import moves one story between browsers as a JSON file.

import { storySchema, type Story } from '@gedcom/shared/story';

const keyFor = (tree: string) => `stories:${tree}`;

export function loadStories(tree: string): Story[] {
  try {
    const raw = localStorage.getItem(keyFor(tree));
    if (!raw) return [];
    // A story that no longer validates (older schema, hand edit) is dropped, not fatal.
    return (JSON.parse(raw) as unknown[]).flatMap((s) => {
      const parsed = storySchema.safeParse(s);
      return parsed.success ? [parsed.data] : [];
    });
  } catch (err) {
    console.warn('Stories unavailable:', err);
    return [];
  }
}

function persist(tree: string, stories: Story[]): void {
  try {
    localStorage.setItem(keyFor(tree), JSON.stringify(stories));
  } catch (err) {
    console.warn('Could not save stories:', err);
  }
}

/** Insert or replace by id; newest first. */
export function saveStory(tree: string, story: Story): Story[] {
  const stories = [story, ...loadStories(tree).filter((s) => s.id !== story.id)];
  persist(tree, stories);
  return stories;
}

export function deleteStory(tree: string, id: string): Story[] {
  const stories = loadStories(tree).filter((s) => s.id !== id);
  persist(tree, stories);
  return stories;
}

/** Throws with a readable message when the file is not a story. */
export function parseStory(json: string): Story {
  const parsed = storySchema.safeParse(JSON.parse(json));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid story');
  return parsed.data;
}

export function slugify(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'historia';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportStory(story: Story): void {
  const blob = new Blob([JSON.stringify(story, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `${slugify(story.title)}.historia.json`);
}
