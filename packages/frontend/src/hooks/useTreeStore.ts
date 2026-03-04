import { create } from 'zustand';
import type { GedcomData, Individual, Family } from '@gedcom/shared';
import { extractSubgraph } from '@/visualization/subgraph-extractor';

function serializeEvent(ev: { type: string; date?: { year?: number; month?: number; day?: number; text?: string }; place?: string } | undefined) {
  if (!ev) return undefined;
  return { type: ev.type, date: ev.date ? { year: ev.date.year, month: ev.date.month, day: ev.date.day, text: ev.date.text } : undefined, place: ev.place };
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

async function uploadToServer(data: GedcomData) {
  try {
    const payload = {
      individuals: Object.fromEntries(
        Array.from(data.individuals.entries()).map(([id, ind]) => [id, serializeIndividual(ind)])
      ),
      families: Object.fromEntries(
        Array.from(data.families.entries()).map(([id, fam]) => [id, serializeFamily(fam)])
      ),
    };
    await fetch('http://localhost:3001/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Server might not be running — fail silently
  }
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

function parseOnWorker(content: string): Promise<{ data: GedcomData; format: string }> {
  return new Promise((resolve, reject) => {
    const worker = getParserWorker();
    const handler = (e: MessageEvent) => {
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
    worker.postMessage({ type: 'parse', content });
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

  loadFile: (content: string, filename: string) => void;
  setFocus: (id: string, generations: number) => void;
  viewAll: () => void;
  changeFocus: () => void;
  selectPerson: (id: string | null) => void;
  togglePersonPanel: () => void;
  clear: () => void;
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

  loadFile: (content, filename) => {
    set({ parsing: true });
    parseOnWorker(content).then(({ data, format }) => {
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
      });
      void uploadToServer(data);
    }).catch((error) => {
      console.error('Failed to parse GEDCOM:', error);
      set({ parsing: false });
      alert('Failed to parse GEDCOM file');
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

  selectPerson: (id) => set({ selectedId: id, personPanelOpen: !!id }),

  togglePersonPanel: () => set((s) => ({ personPanelOpen: !s.personPanelOpen })),

  clear: () => set({
    rawData: null,
    filename: null,
    format: 'Unknown',
    data: null,
    viewData: null,
    focusId: null,
    selectedId: null,
    screen: 'upload',
    parsing: false,
  }),
}));
