import type { Individual } from './individual';
import type { Family } from './family';

export interface GedcomHeader {
  source?: string;
  version?: string;
  char?: string;
  lang?: string;
  date?: string;
  file?: string;
  customTags: Map<string, string>;
}

export interface GedcomData {
  header: GedcomHeader;
  individuals: Map<string, Individual>;
  families: Map<string, Family>;
  sources: Map<string, Source>;
  notes: Map<string, string>;
}

export interface Source {
  id: string;
  title?: string;
  author?: string;
  publication?: string;
  text?: string;
}

export function createGedcomData(): GedcomData {
  return {
    header: { customTags: new Map() },
    individuals: new Map(),
    families: new Map(),
    sources: new Map(),
    notes: new Map(),
  };
}

export function getIndividual(data: GedcomData, id: string): Individual | undefined {
  return data.individuals.get(id);
}

export function getFamily(data: GedcomData, id: string): Family | undefined {
  return data.families.get(id);
}

export function getChildren(data: GedcomData, individualId: string): Individual[] {
  const children: Individual[] = [];
  const ind = getIndividual(data, individualId);
  if (!ind) return children;

  for (const famId of ind.fams) {
    const fam = getFamily(data, famId);
    if (fam) {
      for (const childId of fam.children) {
        const child = getIndividual(data, childId);
        if (child) children.push(child);
      }
    }
  }
  return children;
}

export function getParents(data: GedcomData, individualId: string): { father?: Individual; mother?: Individual } {
  const ind = getIndividual(data, individualId);
  if (!ind?.famc) return {};

  const fam = getFamily(data, ind.famc);
  if (!fam) return {};

  return {
    father: fam.husband ? getIndividual(data, fam.husband) : undefined,
    mother: fam.wife ? getIndividual(data, fam.wife) : undefined,
  };
}

export function getSpouses(data: GedcomData, individualId: string): Individual[] {
  const spouses: Individual[] = [];
  const ind = getIndividual(data, individualId);
  if (!ind) return spouses;

  for (const famId of ind.fams) {
    const fam = getFamily(data, famId);
    if (fam) {
      if (fam.husband && fam.husband !== individualId) {
        const spouse = getIndividual(data, fam.husband);
        if (spouse) spouses.push(spouse);
      }
      if (fam.wife && fam.wife !== individualId) {
        const spouse = getIndividual(data, fam.wife);
        if (spouse) spouses.push(spouse);
      }
    }
  }
  return spouses;
}
