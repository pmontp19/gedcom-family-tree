import { create } from 'zustand';

const MEDIA_BASE_KEY = 'gedcom-media-base';

export interface IndexedFile {
  file: File;
  path: string;
}

interface MediaState {
  files: Map<string, File>;        // normalized posix path -> File
  byBasename: Map<string, string>; // basename -> normalized path (first wins)
  mediaBase: string | null;        // e.g. http://localhost:8080 serving the actes/ folder
  indexedCount: number;
  version: number;                 // bumped when sources change, to trigger re-renders
  addFiles: (entries: IndexedFile[]) => void;
  setMediaBase: (base: string | null) => void;
  resolve: (file: string | undefined) => string | null;
}

// Lazily created object URLs, cached per resolved path
const urlCache = new Map<string, string>();

export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

function lookupPath(files: Map<string, File>, byBasename: Map<string, string>, wanted: string): string | undefined {
  const norm = normalizePath(wanted);
  if (files.has(norm)) return norm;
  // Ends-with match (folder dropped at a different root)
  const suffix = '/' + norm;
  for (const key of files.keys()) {
    if (key.endsWith(suffix)) return key;
  }
  // Basename fallback
  const base = norm.split('/').pop();
  if (base) {
    const hit = byBasename.get(base);
    if (hit) return hit;
  }
  return undefined;
}

export const useMediaStore = create<MediaState>((set, get) => ({
  files: new Map(),
  byBasename: new Map(),
  mediaBase: localStorage.getItem(MEDIA_BASE_KEY),
  indexedCount: 0,
  version: 0,

  addFiles: (entries) => {
    if (entries.length === 0) return;
    const files = get().files;
    const byBasename = get().byBasename;
    let added = 0;
    for (const { file, path } of entries) {
      if (!file.type.startsWith('image/') && !/\.(jpe?g|png|gif|webp|avif)$/i.test(path)) continue;
      const norm = normalizePath(path);
      if (!norm || files.has(norm)) continue;
      files.set(norm, file);
      const base = norm.split('/').pop()!;
      if (!byBasename.has(base)) byBasename.set(base, norm);
      added++;
    }
    if (added > 0) {
      set((s) => ({ indexedCount: s.indexedCount + added, version: s.version + 1 }));
    }
  },

  setMediaBase: (base) => {
    if (base) localStorage.setItem(MEDIA_BASE_KEY, base);
    else localStorage.removeItem(MEDIA_BASE_KEY);
    set((s) => ({ mediaBase: base, version: s.version + 1 }));
  },

  resolve: (file) => {
    if (!file) return null;
    const norm = normalizePath(file);
    // 1) Indexed folder (blob URLs)
    const { files, byBasename } = get();
    const hit = lookupPath(files, byBasename, norm);
    if (hit) {
      const cached = urlCache.get(hit);
      if (cached) return cached;
      const url = URL.createObjectURL(files.get(hit)!);
      urlCache.set(hit, url);
      return url;
    }
    // 2) HTTP base (e.g. python -m http.server on the media folder)
    const base = get().mediaBase;
    if (base) return `${base.replace(/\/$/, '')}/${norm.split('/').map(encodeURIComponent).join('/')}`;
    return null;
  },
}));
