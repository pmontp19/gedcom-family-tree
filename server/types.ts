// Serialized types for JSON transport (Maps → plain objects)

export interface GedcomDate {
  day?: number;
  month?: number;
  year?: number;
  qualifier?: string;
  text?: string;
}

export interface GedcomEvent {
  type: string;
  date?: GedcomDate;
  place?: string;
}

export interface IndividualName {
  full: string;
  given?: string;
  surname?: string;
  prefix?: string;
  suffix?: string;
  nickname?: string;
}

export interface Individual {
  id: string;
  name?: IndividualName;
  sex?: 'M' | 'F' | 'U';
  birth?: GedcomEvent;
  death?: GedcomEvent;
  fams: string[];
  famc?: string;
  events: GedcomEvent[];
  notes: string[];
}

export interface Family {
  id: string;
  husband?: string;
  wife?: string;
  children: string[];
  marriage?: GedcomEvent;
  divorce?: GedcomEvent;
  events: GedcomEvent[];
}

export interface GedcomData {
  individuals: Record<string, Individual>;
  families: Record<string, Family>;
}

// Lean person reference for tool results
export interface PersonRef {
  id: string;
  name: string;
  birth_year: number | null;
  death_year: number | null;
  birthplace: string | null;
  sex: 'M' | 'F' | 'U' | null;
}

export function toPersonRef(ind: Individual): PersonRef {
  return {
    id: ind.id,
    name: ind.name?.full ?? ind.id,
    birth_year: ind.birth?.date?.year ?? null,
    death_year: ind.death?.date?.year ?? null,
    birthplace: ind.birth?.place ?? null,
    sex: ind.sex ?? null,
  };
}

export function getIndividual(data: GedcomData, id: string): Individual | undefined {
  return data.individuals[id];
}

export function getFamily(data: GedcomData, id: string): Family | undefined {
  return data.families[id];
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

export function getChildren(data: GedcomData, individualId: string): Individual[] {
  const ind = getIndividual(data, individualId);
  if (!ind) return [];
  const children: Individual[] = [];
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

export function getSpouses(data: GedcomData, individualId: string): Individual[] {
  const ind = getIndividual(data, individualId);
  if (!ind) return [];
  const spouses: Individual[] = [];
  for (const famId of ind.fams) {
    const fam = getFamily(data, famId);
    if (fam) {
      if (fam.husband && fam.husband !== individualId) {
        const s = getIndividual(data, fam.husband);
        if (s) spouses.push(s);
      }
      if (fam.wife && fam.wife !== individualId) {
        const s = getIndividual(data, fam.wife);
        if (s) spouses.push(s);
      }
    }
  }
  return spouses;
}

export function getSiblings(data: GedcomData, individualId: string): Individual[] {
  const ind = getIndividual(data, individualId);
  if (!ind?.famc) return [];
  const fam = getFamily(data, ind.famc);
  if (!fam) return [];
  return fam.children
    .filter(id => id !== individualId)
    .map(id => getIndividual(data, id))
    .filter((i): i is Individual => i !== undefined);
}
