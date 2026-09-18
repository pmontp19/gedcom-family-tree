import { getDataByTag, getFirstChildByTag } from '../tree-builder.js';
import type { TreeNode } from '../tree-builder.js';
import type { GedcomData, Individual, Family, Event, GedcomHeader, Source, MediaFile } from '@gedcom/shared';
import { parseName, createIndividual, createFamily } from '@gedcom/shared';
import { parseDate } from '../utils/date-parser.js';

/**
 * Canonical GEDCOM version detection: HEAD.GEDC.VERS is the only authority.
 */
export function gedcomVersion(nodes: TreeNode[]): string | undefined {
  const head = nodes.find(n => n.tag === 'HEAD');
  const gedc = head && getFirstChildByTag(head, 'GEDC');
  return gedc && getDataByTag(gedc, 'VERS');
}

/**
 * Individual-level event tags kept on `Individual.events`. BIRT and DEAT have
 * their own fields and are handled apart; everything here used to be dropped,
 * which silently emptied migration and event-type queries for IMMI, EMIG,
 * CENS and friends.
 */
const INDIVIDUAL_EVENT_TAGS = new Set([
  'ADOP', 'BAPM', 'BARM', 'BASM', 'BLES', 'BURI', 'CENS', 'CHR', 'CHRA', 'CONF', 'CREM',
  'EDUC', 'EMIG', 'EVEN', 'FCOM', 'GRAD', 'IMMI', 'MILI', 'NATU', 'ORDN', 'OCCU',
  'PROB', 'PROP', 'RESI', 'RETI', 'WILL',
]);

/**
 * `1 FILE <ref>` with its FORM/TITL. In 7.0 those hang off the FILE; in 5.5.1
 * they sit beside it on the OBJE, so the object-level ones are the fallback.
 */
function parseMediaRecord(node: TreeNode): MediaFile[] {
  const objectTitle = getDataByTag(node, 'TITL');
  const files: MediaFile[] = [];

  for (const child of node.children) {
    if (child.tag !== 'FILE' || !child.data) continue;
    files.push({
      file: child.data,
      title: getDataByTag(child, 'TITL') ?? objectTitle,
      form: getDataByTag(child, 'FORM') ?? getDataByTag(node, 'FORM'),
    });
  }

  return files;
}

export abstract class BaseAdapter {
  abstract readonly name: string;

  /** Top-level `0 @O1@ OBJE` records, so `1 OBJE @O1@` pointers can resolve. */
  protected mediaRecords = new Map<string, MediaFile[]>();

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
        // 7.0 also defines X (other). Anything past M/F is unknown here: an
        // out-of-contract value reached the renderer as an undefined colour
        // and took down the rest of the scene with it.
        ind.sex = node.data === 'M' || node.data === 'F' ? node.data : 'U';
        break;
      case 'BIRT':
        ind.birth = this.parseEvent(node, 'BIRT');
        ind.events.push(this.parseEvent(node, 'BIRT'));
        break;
      case 'DEAT':
        ind.death = this.parseEvent(node, 'DEAT');
        ind.events.push(this.parseEvent(node, 'DEAT'));
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
      case 'OBJE':
        ind.media.push(...this.resolveMedia(node));
        break;
      case 'NOTE':
        if (node.data) ind.notes.push(node.data);
        break;
      case 'SOUR':
        if (node.data) ind.sources.push(this.extractPointer(node.data) || node.data);
        break;
      default:
        if (INDIVIDUAL_EVENT_TAGS.has(node.tag)) {
          ind.events.push(this.parseEvent(node, node.tag));
        } else if (node.tag?.startsWith('_')) {
          ind.customTags.set(node.tag, node.data || '');
        }
    }
  }

  /**
   * An OBJE under a record is either a pointer at a top-level media record
   * (7.0 and most 5.5.1 exporters) or an inline object carrying its own FILE
   * children (5.5.1). Both end up as the same flat list of files.
   */
  protected resolveMedia(node: TreeNode): MediaFile[] {
    const pointer = node.data ? this.extractPointer(node.data) : undefined;
    if (node.data) return pointer ? this.mediaRecords.get(pointer) ?? [] : [];
    return parseMediaRecord(node);
  }

  parseFamily(node: TreeNode): Family {
    const id = node.pointer || '';
    const fam = createFamily(id);

    for (const child of node.children) {
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
        default:
          if (child.tag?.startsWith('_')) {
            fam.customTags.set(child.tag, child.data || '');
          }
      }
    }

    return fam;
  }

  protected parseEvent(node: TreeNode, type: string): Event {
    const event: Event = { type };

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
    // @VOID@ points at no record on purpose; it is not an id.
    return match && match[1] !== 'VOID' ? match[1] : undefined;
  }

  abstract detect(nodes: TreeNode[]): boolean;

  parse(nodes: TreeNode[]): GedcomData {
    const data: GedcomData = {
      header: { customTags: new Map() },
      individuals: new Map(),
      families: new Map(),
      sources: new Map(),
      notes: new Map(),
    };

    // Media records first: individuals point at them and may come earlier.
    this.mediaRecords = new Map();
    for (const node of nodes) {
      if (node.tag === 'OBJE' && node.pointer) {
        this.mediaRecords.set(node.pointer, parseMediaRecord(node));
      }
    }

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
      }
    }

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