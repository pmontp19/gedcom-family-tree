import { create } from 'zustand';
import type { GedcomData, Individual, Family } from '@/models';
import { parseGedcom, detectFormat } from '@/parser';

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

interface TreeState {
  rawData: string | null;
  filename: string | null;
  format: string;
  data: GedcomData | null;
  selectedId: string | null;

  loadFile: (content: string, filename: string) => void;
  selectPerson: (id: string | null) => void;
  clear: () => void;
}

export const useTreeStore = create<TreeState>((set) => ({
  rawData: null,
  filename: null,
  format: 'Unknown',
  data: null,
  selectedId: null,

  loadFile: (content, filename) => {
    try {
      const data = parseGedcom(content);
      const format = detectFormat(content);
      set({
        rawData: content,
        filename,
        format,
        data,
        selectedId: null,
      });
      void uploadToServer(data);
    } catch (error) {
      console.error('Failed to parse GEDCOM:', error);
      alert('Failed to parse GEDCOM file');
    }
  },

  selectPerson: (id) => set({ selectedId: id }),

  clear: () => set({
    rawData: null,
    filename: null,
    format: 'Unknown',
    data: null,
    selectedId: null,
  }),
}));
