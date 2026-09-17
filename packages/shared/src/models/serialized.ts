/**
 * Serialized types for JSON transport (Maps → plain objects)
 * Used for communication between frontend and backend
 */

import type { Event } from './event.js';
import type { Name } from './individual.js';

export interface SerializedIndividual {
  id: string;
  name?: Name;
  aliases: Name[];
  sex?: 'M' | 'F' | 'U';
  birth?: Event;
  death?: Event;
  fams: string[];
  famc: string[];
  events: Event[];
  notes: string[];
}

export interface SerializedFamily {
  id: string;
  husband?: string;
  wife?: string;
  children: string[];
  marriage?: Event;
  divorce?: Event;
  events: Event[];
}

export interface SerializedGedcomData {
  individuals: Record<string, SerializedIndividual>;
  families: Record<string, SerializedFamily>;
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

export function toPersonRef(ind: SerializedIndividual): PersonRef {
  return {
    id: ind.id,
    name: ind.name?.full ?? ind.id,
    birth_year: ind.birth?.date?.year ?? null,
    death_year: ind.death?.date?.year ?? null,
    birthplace: ind.birth?.place ?? null,
    sex: ind.sex ?? null,
  };
}

// Helper functions for serialized data
export function getSerializedIndividual(data: SerializedGedcomData, id: string): SerializedIndividual | undefined {
  return data.individuals[id];
}

export function getSerializedFamily(data: SerializedGedcomData, id: string): SerializedFamily | undefined {
  return data.families[id];
}

export function getSerializedParents(data: SerializedGedcomData, individualId: string): { fathers: SerializedIndividual[]; mothers: SerializedIndividual[] } {
  const ind = getSerializedIndividual(data, individualId);
  if (!ind?.famc?.length) return { fathers: [], mothers: [] };

  const fathers: SerializedIndividual[] = [];
  const mothers: SerializedIndividual[] = [];

  for (const famcId of ind.famc) {
    const fam = getSerializedFamily(data, famcId);
    if (!fam) continue;
    if (fam.husband) {
      const father = getSerializedIndividual(data, fam.husband);
      if (father) fathers.push(father);
    }
    if (fam.wife) {
      const mother = getSerializedIndividual(data, fam.wife);
      if (mother) mothers.push(mother);
    }
  }

  return { fathers, mothers };
}

export function getSerializedChildren(data: SerializedGedcomData, individualId: string): SerializedIndividual[] {
  const ind = getSerializedIndividual(data, individualId);
  if (!ind) return [];
  const children: SerializedIndividual[] = [];
  for (const famId of ind.fams) {
    const fam = getSerializedFamily(data, famId);
    if (fam) {
      for (const childId of fam.children) {
        const child = getSerializedIndividual(data, childId);
        if (child) children.push(child);
      }
    }
  }
  return children;
}

export function getSerializedSpouses(data: SerializedGedcomData, individualId: string): SerializedIndividual[] {
  const ind = getSerializedIndividual(data, individualId);
  if (!ind) return [];
  const spouses: SerializedIndividual[] = [];
  for (const famId of ind.fams) {
    const fam = getSerializedFamily(data, famId);
    if (fam) {
      if (fam.husband && fam.husband !== individualId) {
        const s = getSerializedIndividual(data, fam.husband);
        if (s) spouses.push(s);
      }
      if (fam.wife && fam.wife !== individualId) {
        const s = getSerializedIndividual(data, fam.wife);
        if (s) spouses.push(s);
      }
    }
  }
  return spouses;
}

export function getSerializedSiblings(data: SerializedGedcomData, individualId: string): SerializedIndividual[] {
  const ind = getSerializedIndividual(data, individualId);
  if (!ind?.famc?.length) return [];

  const siblings: SerializedIndividual[] = [];
  for (const famcId of ind.famc) {
    const fam = getSerializedFamily(data, famcId);
    if (!fam) continue;
    for (const childId of fam.children) {
      if (childId !== individualId) {
        const sibling = getSerializedIndividual(data, childId);
        if (sibling) siblings.push(sibling);
      }
    }
  }
  return siblings;
}
