import { tool } from 'ai';
import { z } from 'zod';
import type { PersonRef, SerializedGedcomData } from '@gedcom/shared';
import { getSerializedIndividual, getSerializedParents, toPersonRef } from '@gedcom/shared';

export interface AhnentafelEntry extends PersonRef {
  /** Canonical Ahnentafel number: subject 1, father of k is 2k, mother is 2k+1. */
  ahnentafel: number;
  /** 1 = the subject, 2 = parents, 3 = grandparents, ... */
  generation: number;
  relation: string;
  death_place: string | null;
  age_at_death: number | null;
  summary: string;
}

/**
 * Ahnentafel relation names, matching the wording used by `get_ancestors`.
 * Parity of the number decides the sex of the link: even = father, odd = mother.
 */
function relationFor(ahnentafel: number, generation: number): string {
  if (generation === 1) return 'Self';
  const parent = ahnentafel % 2 === 0 ? 'father' : 'mother';
  if (generation === 2) return parent === 'father' ? 'Father' : 'Mother';
  if (generation === 3) return `Grand${parent}`;
  if (generation === 4) return `Great-Grand${parent}`;
  return `${generation - 3}x Great-Grand${parent}`;
}

function summarize(ref: PersonRef, deathPlace: string | null, age: number | null): string {
  const parts: string[] = [];
  if (ref.birth_year && ref.death_year) parts.push(`${ref.birth_year}–${ref.death_year}`);
  else if (ref.birth_year) parts.push(`b. ${ref.birth_year}`);
  else if (ref.death_year) parts.push(`d. ${ref.death_year}`);
  if (ref.birthplace) parts.push(`born in ${ref.birthplace}`);
  if (deathPlace) parts.push(`died in ${deathPlace}`);
  if (age !== null) parts.push(`died aged ${age}`);
  return parts.length > 0 ? `${ref.name} (${parts.join(', ')})` : ref.name;
}

/**
 * Walk the direct ancestor line in Ahnentafel order, subject first.
 *
 * A person legitimately appears twice when two lines converge (cousin
 * marriage), so entries are keyed by number, never deduplicated by id. Only
 * the first father and first mother count: extra FAMC links are adoptions,
 * which the canonical numbering has no slot for.
 */
export function ancestorReport(
  data: SerializedGedcomData,
  rootId: string,
  maxGenerations = 5
): AhnentafelEntry[] {
  const root = getSerializedIndividual(data, rootId);
  if (!root) return [];

  const entries: AhnentafelEntry[] = [];
  const queue: Array<{ id: string; ahnentafel: number; generation: number }> = [
    { id: rootId, ahnentafel: 1, generation: 1 },
  ];

  while (queue.length > 0) {
    const { id, ahnentafel, generation } = queue.shift()!;
    const ind = getSerializedIndividual(data, id);
    if (!ind) continue;

    const ref = toPersonRef(ind);
    const deathPlace = ind.death?.place ?? null;
    const age = ref.birth_year && ref.death_year ? ref.death_year - ref.birth_year : null;
    entries.push({
      ...ref,
      ahnentafel,
      generation,
      relation: relationFor(ahnentafel, generation),
      death_place: deathPlace,
      age_at_death: age,
      summary: summarize(ref, deathPlace, age),
    });

    if (generation >= maxGenerations) continue;
    const { fathers, mothers } = getSerializedParents(data, id);
    if (fathers[0]) queue.push({ id: fathers[0].id, ahnentafel: ahnentafel * 2, generation: generation + 1 });
    if (mothers[0]) queue.push({ id: mothers[0].id, ahnentafel: ahnentafel * 2 + 1, generation: generation + 1 });
  }

  return entries.sort((a, b) => a.ahnentafel - b.ahnentafel);
}

export interface MigrationStep {
  year: number | null;
  place: string;
  personName: string;
  event: string;
  generation: number;
  ahnentafel: number;
}

/**
 * Every placed event of a person and their direct ancestors, oldest first.
 * Undated events keep their place but sort last, where they cannot fake an origin.
 */
export function migrationJourney(
  data: SerializedGedcomData,
  personId: string,
  maxGenerations = 4
): { rootName: string; origin: MigrationStep | null; steps: MigrationStep[] } {
  const line = ancestorReport(data, personId, maxGenerations);
  const steps: MigrationStep[] = [];
  // A marriage belongs to the couple: record it once even when both spouses are ancestors.
  const seenFamilyEvents = new Set<string>();

  for (const entry of line) {
    const ind = getSerializedIndividual(data, entry.id)!;
    const context = { personName: entry.name, generation: entry.generation, ahnentafel: entry.ahnentafel };

    for (const ev of ind.events) {
      if (ev.place) steps.push({ year: ev.date?.year ?? null, place: ev.place, event: ev.type, ...context });
    }

    for (const famId of ind.fams) {
      const fam = data.families[famId];
      if (!fam) continue;
      for (const ev of fam.events) {
        const key = `${famId}:${ev.type}:${ev.date?.year ?? ''}`;
        if (!ev.place || seenFamilyEvents.has(key)) continue;
        seenFamilyEvents.add(key);
        steps.push({ year: ev.date?.year ?? null, place: ev.place, event: ev.type, ...context });
      }
    }
  }

  steps.sort((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity));

  return {
    rootName: line[0]?.name ?? personId,
    origin: steps.find(s => s.year !== null) ?? null,
    steps,
  };
}

export function reportsTools(data: SerializedGedcomData) {
  return {
    generate_ancestor_report: tool({
      description:
        'Ahnentafel ancestor report: the direct ancestors of a person with their canonical ' +
        'Ahnentafel number (subject 1, father 2k, mother 2k+1), generation, relation, dates, ' +
        'places and age at death. Render the result with AncestorList.',
      inputSchema: z.object({
        rootId: z.string(),
        maxGenerations: z.number().min(1).max(10).default(5),
      }),
      execute: async ({ rootId, maxGenerations }) => {
        const items = ancestorReport(data, rootId, maxGenerations);
        return {
          items,
          total: items.length,
          generations: items.reduce((max, e) => Math.max(max, e.generation), 0),
        };
      },
    }),

    analyze_migration: tool({
      description:
        'Geographic migration of a person and their direct ancestors: every event that carries ' +
        'a place, oldest first, with the earliest recorded origin. Render with MigrationTimeline.',
      inputSchema: z.object({
        personId: z.string(),
        maxGenerations: z.number().min(1).max(10).default(4),
      }),
      execute: async ({ personId, maxGenerations }) => {
        const journey = migrationJourney(data, personId, maxGenerations);
        return {
          ...journey,
          places: [...new Set(journey.steps.map(s => s.place))],
        };
      },
    }),
  };
}
