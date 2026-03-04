import type { TreeNode } from '@/parser/tree-builder';
import type { GedcomData, Individual, Family, Event, GedcomHeader } from '@/models';
import { parseDate } from '@/parser/utils/date-parser';
import { parseName, createIndividual } from '@/models/individual';
import { createFamily } from '@/models/family';

export abstract class BaseAdapter {
  abstract readonly name: string;

  parseHeader(node: TreeNode): GedcomHeader {
    const header: GedcomHeader = { customTags: new Map() };

    for (const child of node.children) {
      switch (child.tag) {
        case 'SOUR':
          header.source = child.data;
          break;
        case 'GEDC':
          const versNode = child.children.find(c => c.tag === 'VERS');
          if (versNode) header.version = versNode.data;
          break;
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
          ind.name = parseName(node.data);
        }
        break;
      case 'SEX':
        ind.sex = node.data as 'M' | 'F' | 'U';
        break;
      case 'BIRT':
        ind.birth = this.parseEvent(node, 'BIRT');
        break;
      case 'DEAT':
        ind.death = this.parseEvent(node, 'DEAT');
        break;
      case 'FAMS':
        if (node.data) {
          const famId = this.extractPointer(node.data);
          if (famId) ind.fams.push(famId);
        }
        break;
      case 'FAMC':
        if (node.data) {
          ind.famc = this.extractPointer(node.data);
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
          break;
        case 'DIV':
          fam.divorce = this.parseEvent(child, 'DIV');
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
    return match ? match[1] : undefined;
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

    for (const node of nodes) {
      switch (node.tag) {
        case 'HEAD':
          data.header = this.parseHeader(node);
          break;
        case 'INDI':
          const ind = this.parseIndividual(node);
          data.individuals.set(ind.id, ind);
          break;
        case 'FAM':
          const fam = this.parseFamily(node);
          data.families.set(fam.id, fam);
          break;
      }
    }

    return data;
  }
}
