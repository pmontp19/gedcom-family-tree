import { tool } from 'ai';
import { z } from 'zod';
import type { GedcomData } from '../types.js';
import { toPersonRef } from '../types.js';

export function searchTools(data: GedcomData) {
  const individuals = Object.values(data.individuals);

  return {
    search_individuals: tool({
      description: 'Search individuals by name (case-insensitive partial match). Always use this before assuming an ID.',
      parameters: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        const q = query.toLowerCase();
        return individuals
          .filter(ind => (ind.name?.full ?? ind.id).toLowerCase().includes(q))
          .slice(0, 20)
          .map(toPersonRef);
      },
    }),

    find_by_birth_year_range: tool({
      description: 'Find individuals born within a year range',
      parameters: z.object({
        from_year: z.number(),
        to_year: z.number(),
      }),
      execute: async ({ from_year, to_year }) => {
        return individuals
          .filter(ind => {
            const y = ind.birth?.date?.year;
            return y !== undefined && y >= from_year && y <= to_year;
          })
          .map(toPersonRef);
      },
    }),

    find_by_birthplace: tool({
      description: 'Find individuals born in a specific place (partial match)',
      parameters: z.object({ place: z.string() }),
      execute: async ({ place }) => {
        const p = place.toLowerCase();
        return individuals
          .filter(ind => ind.birth?.place?.toLowerCase().includes(p))
          .map(toPersonRef);
      },
    }),

    get_all_individuals: tool({
      description: 'Get a summary count and sample of all individuals in the GEDCOM file',
      parameters: z.object({}),
      execute: async () => {
        return {
          total: individuals.length,
          families: Object.keys(data.families).length,
          sample: individuals.slice(0, 10).map(toPersonRef),
        };
      },
    }),
  };
}
