import type { TreeNode } from '../tree-builder.js';
import type { GedcomData, Individual, Family, Event, GedcomHeader, Source, Media } from '@gedcom/shared';
import { parseName, createIndividual, createFamily, createMedia } from '@gedcom/shared';
import { parseDate } from '../utils/date-parser.js';

const POINTER_RE = /^@(\w+)@$/;

function isPointer(data: string | undefined): string | undefined {
  if (!data) return undefined;
  const m = data.match(POINTER_RE);
  return m ? m[1] : undefined;
}

export abstract class BaseAdapter {
  abstract readonly name: string;

  parseHeader(node: TreeNode): GedcomHeader {
    const header: GedcomHeader = { customTags: new Map() };

    for (const child of node.children) {
      switch (child.tag) {
        case 'SOUR':
          header.source = child.data;
          break;
        case 'GEDC': {
          const versNode = child.children.find(c => c.tag === 'VERS');
          if (versNode) header.version = versNode.data;
          break;
        }
        case 'CHAR':
          header.char = child.data;
          break;
        case 'LANG':
          header.lang = child.data;
          break;
        case 'DATE':
          header.date = child.data;
          break;
        case 'FILE':
          header.file = child.data;
          break;
        default:
          if (child.tag?.startsWith('_')) {
            header.customTags.set(child.tag, child.data || '');
          }
      }
    }

    return header;
  }

  parseIndividual(node: TreeNode): Individual {
    const id = node.pointer || '';
    const ind = createIndividual(id);

    for (const child of node.children) {
      this.parseIndividualField(ind, child);
    }

    return ind;
  }

  protected parseIndividualField(ind: Individual, node: TreeNode): void {
    switch (node.tag) {
      case 'NAME':
        if (node.data) {
          if (!ind.name) {
            ind.name = parseName(node.data);
          } else {
            ind.aliases.push(parseName(node.data));
          }
        }
        break;
      case 'SEX':
        ind.sex = node.data as 'M' | 'F' | 'U';
        break;
      case 'BIRT': {
        const ev = this.parseEvent(node, 'BIRT');
        ind.birth = ev;
        ind.events.push(ev);
        break;
      }
      case 'DEAT': {
        const ev = this.parseEvent(node, 'DEAT');
        ind.death = ev;
        ind.events.push(ev);
        break;
      }
      case 'BAPM':
      case 'CHR':
      case 'BURI':
      case 'ADOP':
      case 'OCCU':
      case 'RESI':
        ind.events.push(this.parseEvent(node, node.tag));
        break;
      case 'FAMS':
        if (node.data) {
          const famId = this.extractPointer(node.data);
          if (famId) ind.fams.push(famId);
        }
        break;
      case 'FAMC':
        if (node.data) {
          const famId = this.extractPointer(node.data);
          if (famId) ind.famc.push(famId);
        }
        break;
      case 'RIN':
        ind.rin = node.data;
        break;
      case '_UID':
        ind.uid = node.data;
        break;
      case 'NOTE':
        if (node.data) ind.notes.push(node.data);
        break;
      case 'SOUR':
        if (node.data) ind.sources.push(this.extractPointer(node.data) || node.data);
        break;
      case 'OBJE':
        ind.media.push(this.parseMedia(node));
        break;
      default:
        if (node.tag?.startsWith('_')) {
          ind.customTags.set(node.tag, node.data || '');
        }
    }
  }

  parseFamily(node: TreeNode): Family {
    const id = node.pointer || '';
    const fam = createFamily(id);

    for (const child of node.children) {
      this.parseFamilyField(fam, child);
    }

    return fam;
  }

  protected parseFamilyField(fam: Family, child: TreeNode): void {
    switch (child.tag) {
        case 'HUSB':
          if (child.data) fam.husband = this.extractPointer(child.data);
          break;
        case 'WIFE':
          if (child.data) fam.wife = this.extractPointer(child.data);
          break;
        case 'CHIL':
          if (child.data) {
            const childId = this.extractPointer(child.data);
            if (childId) fam.children.push(childId);
          }
          break;
        case 'MARR':
          fam.marriage = this.parseEvent(child, 'MARR');
          fam.events.push(this.parseEvent(child, 'MARR'));
          break;
        case 'DIV':
          fam.divorce = this.parseEvent(child, 'DIV');
          fam.events.push(this.parseEvent(child, 'DIV'));
          break;
        case 'NOTE':
          if (child.data) fam.notes.push(child.data);
          break;
        case 'SOUR':
          if (child.data) fam.sources.push(this.extractPointer(child.data) || child.data);
          break;
        case 'OBJE':
          fam.media.push(this.parseMedia(child));
          break;
        default:
          if (child.tag?.startsWith('_')) {
            fam.customTags.set(child.tag, child.data || '');
          }
      }
  }

  protected parseEvent(node: TreeNode, type: string): Event {    const event: Event = { type };

    for (const child of node.children) {
      switch (child.tag) {
        case 'DATE':
          if (child.data) event.date = parseDate(child.data);
          break;
        case 'PLAC':
          event.place = child.data;
          break;
        case 'NOTE':
          if (child.data) {
            event.notes = event.notes || [];
            event.notes.push(child.data);
          }
          break;
        case 'SOUR':
          if (child.data) {
            event.sources = event.sources || [];
            event.sources.push(this.extractPointer(child.data) || child.data);
          }
          break;
        default:
          if (child.tag?.startsWith('_')) {
            event.customTags = event.customTags || new Map();
            event.customTags.set(child.tag, child.data || '');
          }
      }
    }

    return event;
  }

  protected extractPointer(data: string): string | undefined {
    const match = data.match(/@(\w+)@/);
    return match ? match[1] : undefined;
  }

  /**
   * Parse an OBJE record. Two forms:
   *  - Inline: OBJE with children FORM/FILE/TITL/NOTE/custom tags.
   *  - Reference: OBJE whose data is a pointer like @O1@; stored as a placeholder
   *    { id } and resolved against data.media by resolveMediaPointers().
   */
  protected parseMedia(node: TreeNode): Media {
    const referencedId = isPointer(node.data);
    if (referencedId) {
      return createMedia(referencedId);
    }

    const media = createMedia('');

    for (const child of node.children) {
      switch (child.tag) {
        case 'FORM':
          media.form = child.data;
          break;
        case 'FILE':
          media.file = child.data;
          break;
        case 'TITL':
          media.title = child.data;
          break;
        case 'NOTE':
          if (child.data) {
            media.note = media.note ? `${media.note}\n${child.data}` : child.data;
          }
          break;
        default:
          if (child.tag?.startsWith('_')) {
            media.customTags.set(child.tag, child.data || '');
          }
      }
    }

    if (media.file) {
      media.id = media.file;
    }
    // _PRIM Y marks the primary photo (MyHeritage exports)
    if (media.customTags.get('_PRIM')?.toUpperCase() === 'Y') {
      media.primary = true;
    }
    return media;
  }

  /** Replace media placeholders (@O…@ references) with the resolved top-level records. */
  protected resolveMediaPointers(data: GedcomData): void {
    const resolve = (media: Media): Media | null => {
      if (media.file) return media;  // inline, already complete
      const resolved = data.media.get(media.id);
      return resolved ?? null;  // drop dangling references
    };
    for (const ind of data.individuals.values()) {
      ind.media = ind.media.map(resolve).filter((m): m is Media => m !== null);
    }
    for (const fam of data.families.values()) {
      fam.media = fam.media.map(resolve).filter((m): m is Media => m !== null);
    }
  }

  /** Replace note pointers (@N…@) with the text of the shared NOTE records. */
  protected resolveNotePointers(data: GedcomData): void {
    const resolve = (note: string): string => {
      const id = note.match(POINTER_RE)?.[1];
      return (id && data.notes.get(id)) || note;
    };
    const resolveEvent = (ev: Event): Event => {
      if (ev.notes) ev.notes = ev.notes.map(resolve);
      return ev;
    };
    for (const ind of data.individuals.values()) {
      ind.notes = ind.notes.map(resolve);
      ind.events = ind.events.map(resolveEvent);
    }
    for (const fam of data.families.values()) {
      fam.notes = fam.notes.map(resolve);
      fam.events = fam.events.map(resolveEvent);
    }
  }

  abstract detect(nodes: TreeNode[]): boolean;

  parse(nodes: TreeNode[]): GedcomData {
    const data: GedcomData = {
      header: { customTags: new Map() },
      individuals: new Map(),
      families: new Map(),
      sources: new Map(),
      notes: new Map(),
      media: new Map(),
    };

    for (const node of nodes) {
      switch (node.tag) {
        case 'HEAD':
          data.header = this.parseHeader(node);
          break;
        case 'INDI': {
          const ind = this.parseIndividual(node);
          data.individuals.set(ind.id, ind);
          break;
        }
        case 'FAM': {
          const fam = this.parseFamily(node);
          data.families.set(fam.id, fam);
          break;
        }
        case 'SOUR': {
          const source = this.parseSource(node);
          if (source) data.sources.set(source.id, source);
          break;
        }
        case 'NOTE':
          // Shared NOTE record: 0 @N1@ NOTE text (CONT/CONC already merged)
          if (node.pointer) {
            data.notes.set(node.pointer, node.data || '');
          }
          break;
        case 'OBJE': {
          const media = this.parseMedia(node);
          if (media.file) data.media.set(node.pointer || media.id, media);
          break;
        }
      }
    }

    this.resolveMediaPointers(data);
    this.resolveNotePointers(data);

    return data;
  }

  protected parseSource(node: TreeNode): Source | null {
    const id = node.pointer;
    if (!id) return null;

    const source: Source = { id };

    for (const child of node.children) {
      switch (child.tag) {
        case 'TITL':
          source.title = child.data;
          break;
        case 'AUTH':
          source.author = child.data;
          break;
        case 'PUBL':
          source.publication = child.data;
          break;
        case 'TEXT':
          source.text = child.data;
          break;
      }
    }

    return source;
  }
}