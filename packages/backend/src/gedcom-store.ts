import type { SerializedGedcomData } from '@gedcom/shared';

let store: SerializedGedcomData | null = null;

export const gedcomStore = {
  set(data: SerializedGedcomData) {
    store = data;
  },
  get(): SerializedGedcomData | null {
    return store;
  },
};
