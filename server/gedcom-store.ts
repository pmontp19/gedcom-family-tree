import type { GedcomData } from './types.js';

let store: GedcomData | null = null;

export const gedcomStore = {
  set(data: GedcomData) {
    store = data;
  },
  get(): GedcomData | null {
    return store;
  },
};
