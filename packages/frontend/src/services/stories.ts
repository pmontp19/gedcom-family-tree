// Stories live in the browser, per tree: the tree itself never leaves it
// either. Export/import moves one story between browsers as a JSON file.

import { storySchema, type Story } from '@gedcom/shared/story';

const keyFor = (tree: string) => `stories:${tree}`;

/** Stored entries as they are: one that no longer validates is hidden, never erased. */
function loadRaw(tree: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(keyFor(tree)) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Stories unavailable:', err);
    return [];
  }
}

const valid = (raw: unknown[]): Story[] => raw.flatMap((s) => {
  const parsed = storySchema.safeParse(s);
  return parsed.success ? [parsed.data] : [];
});

const idOf = (s: unknown) => (s as { id?: unknown } | null)?.id;

export function loadStories(tree: string): Story[] {
  return valid(loadRaw(tree));
}

/** Throws when the browser refuses (quota, private mode): the caller says so. */
function persist(tree: string, raw: unknown[]): Story[] {
  localStorage.setItem(keyFor(tree), JSON.stringify(raw));
  return valid(raw);
}

/** Insert or replace by id; newest first. */
export function saveStory(tree: string, story: Story): Story[] {
  return persist(tree, [story, ...loadRaw(tree).filter((s) => idOf(s) !== story.id)]);
}

export function deleteStory(tree: string, id: string): Story[] {
  return persist(tree, loadRaw(tree).filter((s) => idOf(s) !== id));
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
