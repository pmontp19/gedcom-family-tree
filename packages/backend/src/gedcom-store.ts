import type { SerializedGedcomData } from '@gedcom/shared';

let store: SerializedGedcomData | null = null;
let rawFile: Buffer | null = null;

export const gedcomStore = {
  set(data: SerializedGedcomData, raw: Buffer | null = null) {
    store = data;
    rawFile = raw;
  },
  get(): SerializedGedcomData | null {
    return store;
  },
  /** Original GEDCOM text, needed by the gedlint audit tools. */
  getRaw(): Buffer | null {
    return rawFile;
  },
};
