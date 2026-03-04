import { create } from 'zustand';
import type { GedcomData } from '@/models';
import { parseGedcom, detectFormat } from '@/parser';

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
