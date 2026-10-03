import { create } from 'zustand';
import type { GedcomData, Individual, Family, Event } from '@gedcom/shared';
import type { Story } from '@gedcom/shared/story';
import type { OpenedPackage } from '@/services/story-package';
import { extractSubgraph } from '@/visualization/subgraph-extractor';
import { runGedlint, type GedlintResult } from '@/services/gedlint';
import { attachMedia } from '@/services/gedzip';

// Stories validate with zod: load that only once a tree is open, not with the upload screen.
const storyStorage = () => import('@/services/stories');
import { AI_ENABLED, API_URL } from '@/config';

function serializeEvent(ev: Event | undefined) {
  if (!ev) return undefined;
  return {
    type: ev.type,
    date: ev.date ? { year: ev.date.year, month: ev.date.month, day: ev.date.day, text: ev.date.text } : undefined,
    place: ev.place,
    value: ev.value,
    notes: ev.notes,
    sources: ev.sources,
  };
}

function serializeIndividual(ind: Individual) {
  return {
    id: ind.id,
    name: ind.name ? { full: ind.name.full, given: ind.name.given, surname: ind.name.surname } : undefined,
    sex: ind.sex,
    birth: serializeEvent(ind.birth),
    death: serializeEvent(ind.death),
    fams: ind.fams,
    famc: ind.famc,
    events: ind.events.map(e => serializeEvent(e)!),
    notes: ind.notes,
    sources: ind.sources,
    media: ind.media.map(({ file, title }) => ({ file, title })),
  };
}

function serializeFamily(fam: Family) {
  return {
    id: fam.id,
    husband: fam.husband,
    wife: fam.wife,
    children: fam.children,
    marriage: serializeEvent(fam.marriage),
    divorce: serializeEvent(fam.divorce),
    events: fam.events.map(e => serializeEvent(e)!),
  };
}

/** btoa() only takes a string, and spreading a whole file blows the call stack. */
function toBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i += 0x8000) {
    binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function uploadToServer(data: GedcomData, bytes: ArrayBuffer) {
  try {
    const payload = {
      individuals: Object.fromEntries(
        Array.from(data.individuals.entries()).map(([id, ind]) => [id, serializeIndividual(ind)])
      ),
      families: Object.fromEntries(
        Array.from(data.families.entries()).map(([id, fam]) => [id, serializeFamily(fam)])
      ),
      sources: Object.fromEntries(data.sources),
      raw: toBase64(bytes),
    };
    await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Server might not be running — fail silently
  }
}

/** Blob URLs live until revoked; a new tree or a clear ends the old one's. */
function revokeMedia(urls: string[]) {
  for (const url of urls) URL.revokeObjectURL(url);
}

// Parser worker singleton
let parserWorker: Worker | null = null;
function getParserWorker(): Worker {
  if (!parserWorker) {
    parserWorker = new Worker(
      new URL('../workers/parser.worker.ts', import.meta.url),
      { type: 'module' }
    );
  }
  return parserWorker;
}

let parseSeq = 0;
let loadSeq = 0;
function parseOnWorker(content: string): Promise<{ data: GedcomData; format: string }> {
  const id = ++parseSeq;
  return new Promise((resolve, reject) => {
    const worker = getParserWorker();
    const handler = (e: MessageEvent) => {
      if (e.data.id !== id) return; // another load's answer
      worker.removeEventListener('message', handler);
      worker.removeEventListener('error', errHandler);
      if (e.data.type === 'parse-result') {
        resolve({ data: e.data.data, format: e.data.format });
      } else if (e.data.type === 'parse-error') {
        reject(new Error(e.data.message));
      }
    };
    const errHandler = (err: ErrorEvent) => {
      worker.removeEventListener('message', handler);
      worker.removeEventListener('error', errHandler);
      reject(new Error(err.message));
    };
    worker.addEventListener('message', handler);
    worker.addEventListener('error', errHandler);
    worker.postMessage({ type: 'parse', id, content });
  });
}

type AppScreen = 'upload' | 'focus-select' | 'tree-view';

interface TreeState {
  rawData: string | null;
  filename: string | null;
  format: string;
  data: GedcomData | null;
  viewData: GedcomData | null;
  focusId: string | null;
  maxGenerations: number;
  screen: AppScreen;
  selectedId: string | null;
  personPanelOpen: boolean;
  parsing: boolean;
  lintResult: GedlintResult | null;
  linting: boolean;
  mediaUrls: string[];
  stories: Story[];
  playingStory: Story | null;

  loadFile: (content: string, filename: string, bytes: ArrayBuffer, media?: Map<string, string>) => void;
  /** A story package: no GEDCOM, straight into the story. */
  openPackage: (pkg: OpenedPackage, filename: string) => void;
  setFocus: (id: string, generations: number) => void;
  viewAll: () => void;
  changeFocus: () => void;
  selectPerson: (id: string | null) => void;
  togglePersonPanel: () => void;
  clear: () => void;
  saveStory: (story: Story) => Promise<void>;
  deleteStory: (id: string) => Promise<void>;
  playStory: (story: Story | null) => void;
}

export const useTreeStore = create<TreeState>((set, get) => ({
  rawData: null,
  filename: null,
  format: 'Unknown',
  data: null,
  viewData: null,
  focusId: null,
  maxGenerations: 4,
  screen: 'upload',
  selectedId: null,
  personPanelOpen: false,
  parsing: false,
  lintResult: null,
  linting: false,
  mediaUrls: [],
  stories: [],
  playingStory: null,

  loadFile: (content, filename, bytes, media) => {
    // A newer load supersedes this one; its late results must not land.
    const load = ++loadSeq;
    const current = () => load === loadSeq;
    revokeMedia(get().mediaUrls);
    set({ parsing: true, lintResult: null, linting: true, mediaUrls: [...(media?.values() ?? [])] });
    // Health check runs beside the parse: the tree renders without waiting.
    runGedlint(bytes)
      .then((lintResult) => { if (current()) set({ lintResult, linting: false }); })
      .catch((error) => {
        console.warn('gedlint unavailable:', error);
        if (current()) set({ linting: false });
      });
    parseOnWorker(content).then(({ data, format }) => {
      if (!current()) return;
      // Anything parses as an empty tree: an HTML page, a CSV. Nothing to show is a failed load.
      if (data.individuals.size === 0) {
        set({ parsing: false, lintResult: null, linting: false });
        alert(`No s'ha trobat cap persona a ${filename}. És un fitxer GEDCOM?`);
        return;
      }
      if (media) attachMedia(data, media);
      set({
        rawData: content,
        filename,
        format,
        data,
        viewData: null,
        focusId: null,
        selectedId: null,
        screen: 'focus-select',
        parsing: false,
        stories: [],
        playingStory: null,
      });
      void storyStorage().then((m) => { if (current()) set({ stories: m.loadStories(filename) }); });
      // The tree holds living relatives' data: it only leaves the browser for the AI.
      if (AI_ENABLED) void uploadToServer(data, bytes);
    }).catch((error) => {
      console.error('Failed to parse GEDCOM:', error);
      if (!current()) return;
      set({ parsing: false });
      alert('No s\'ha pogut llegir el fitxer GEDCOM');
    });
  },

  openPackage: ({ story, data, media }, filename) => {
    loadSeq++; // drop any load still in flight
    revokeMedia(get().mediaUrls);
    set({
      rawData: null,
      filename,
      format: 'Història',
      data,
      viewData: data,
      focusId: story.rootId,
      selectedId: null,
      screen: 'tree-view',
      parsing: false,
      lintResult: null,
      linting: false,
      mediaUrls: [...media.values()],
      stories: [story],
      playingStory: story,
    });
  },

  setFocus: (id, generations) => {
    const { data } = get();
    if (!data) return;
    const viewData = extractSubgraph(data, id, generations);
    set({
      focusId: id,
      maxGenerations: generations,
      viewData,
      screen: 'tree-view',
      selectedId: null,
    });
  },

  viewAll: () => {
    const { data } = get();
    if (!data) return;
    set({
      focusId: null,
      viewData: data,
      screen: 'tree-view',
      selectedId: null,
    });
  },

  changeFocus: () => set({ screen: 'focus-select', selectedId: null }),

  selectPerson: (id) => {
    const { data, viewData, maxGenerations } = get();
    // Someone outside the focused view (a relative picked in the panel, an AI
    // link): refocus the tree on them instead of selecting an invisible node.
    if (id && data?.individuals.has(id) && viewData && !viewData.individuals.has(id)) {
      set({ focusId: id, viewData: extractSubgraph(data, id, maxGenerations) });
    }
    set({ selectedId: id, personPanelOpen: !!id });
  },

  togglePersonPanel: () => set((s) => ({ personPanelOpen: !s.personPanelOpen })),

  clear: () => {
    loadSeq++; // drop any load still in flight
    revokeMedia(get().mediaUrls);
    set({
      rawData: null,
      filename: null,
      format: 'Unknown',
      data: null,
      viewData: null,
      focusId: null,
      selectedId: null,
      screen: 'upload',
      parsing: false,
      lintResult: null,
      linting: false,
      mediaUrls: [],
      stories: [],
      playingStory: null,
    });
  },

  saveStory: async (story) => {
    const { filename } = get();
    const m = await storyStorage();
    if (filename && filename === get().filename) set({ stories: m.saveStory(filename, story) });
  },

  deleteStory: async (id) => {
    const { filename } = get();
    const m = await storyStorage();
    if (filename && filename === get().filename) set({ stories: m.deleteStory(filename, id) });
  },

  playStory: (story) => set({ playingStory: story }),
}));
