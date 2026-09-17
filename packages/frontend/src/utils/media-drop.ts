import type { IndexedFile } from '@/hooks/useMediaStore';

interface EntryLike {
  isFile: boolean;
  isDirectory: boolean;
  fullPath: string;
  file?: (cb: (f: File) => void, err?: (e: unknown) => void) => void;
  createReader?: () => {
    readEntries: (cb: (entries: EntryLike[]) => void, err?: (e: unknown) => void) => void;
  };
}

async function walkEntry(entry: EntryLike, out: IndexedFile[]): Promise<void> {
  if (entry.isFile && entry.file) {
    const file = await new Promise<File>((resolve, reject) => {
      entry.file!(resolve, reject);
    });
    out.push({ file, path: entry.fullPath });
  } else if (entry.isDirectory && entry.createReader) {
    const reader = entry.createReader();
    // readEntries returns at most 100 entries per call
    for (;;) {
      const batch = await new Promise<EntryLike[]>((resolve, reject) => {
        reader.readEntries(resolve, reject);
      });
      if (batch.length === 0) break;
      for (const child of batch) await walkEntry(child, out);
    }
  }
}

/** Collect image files (recursive from dropped folders) and .ged files from a drop event. */
export async function collectFilesFromDataTransfer(
  dt: DataTransfer,
): Promise<{ files: IndexedFile[]; gedFiles: File[] }> {
  const out: IndexedFile[] = [];
  const gedFiles: File[] = [];

  const entries: EntryLike[] = [];
  for (const item of Array.from(dt.items ?? [])) {
    const entry = (item as unknown as { webkitGetAsEntry?: () => EntryLike | null }).webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }

  for (const entry of entries) await walkEntry(entry, out);

  for (const file of Array.from(dt.files ?? [])) {
    if (/\.ged(com)?$/i.test(file.name)) {
      gedFiles.push(file);
    } else if (entries.length === 0) {
      out.push({ file, path: file.name });
    }
  }

  return { files: out, gedFiles };
}
