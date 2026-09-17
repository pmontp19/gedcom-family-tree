export interface Media {
  id: string;
  form?: string;      // e.g. 'jpg', 'png'
  file?: string;      // relative path as written in FILE
  title?: string;
  note?: string;      // NOTE under OBJE (research notes, captions)
  primary?: boolean;  // _PRIM Y (MyHeritage) or first media of the record
  customTags: Map<string, string>;  // _FILESIZE, _CUTOUT, _POSITION, ...
}

export function createMedia(id: string): Media {
  return { id, customTags: new Map() };
}

export function getMediaFilename(media: Media): string | undefined {
  if (!media.file) return undefined;
  // Normalize backslashes and strip leading './'
  return media.file.replace(/\\/g, '/').replace(/^\.\//, '');
}

/** FILE path of the primary photo (_PRIM Y) or the first available media. */
export function getPrimaryMediaFile(media: Media[]): string | undefined {
  if (media.length === 0) return undefined;
  return (media.find(m => m.primary) ?? media[0]).file;
}
