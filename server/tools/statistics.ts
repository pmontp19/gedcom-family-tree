import { tool } from 'ai';
import { z } from 'zod';
import type { GedcomData } from '../types.js';

export function statisticsTools(data: GedcomData) {
  const individuals = Object.values(data.individuals);

  return {
    lifespan_stats: tool({
      description: 'Calculate average lifespan, oldest/youngest, birth year distribution',
      parameters: z.object({}),
      execute: async () => {
        const lifespans: number[] = [];
        let oldestAge = 0, oldestName = '';
        let earliestBirth: number | null = null, latestBirth: number | null = null;

        for (const ind of individuals) {
          const birthYear = ind.birth?.date?.year;
          const deathYear = ind.death?.date?.year;

          if (birthYear) {
            if (earliestBirth === null || birthYear < earliestBirth) earliestBirth = birthYear;
            if (latestBirth === null || birthYear > latestBirth) latestBirth = birthYear;
          }

          if (birthYear && deathYear) {
            const age = deathYear - birthYear;
            lifespans.push(age);
            if (age > oldestAge) {
              oldestAge = age;
              oldestName = ind.name?.full ?? ind.id;
            }
          }
        }

        const avg = lifespans.length > 0
          ? Math.round(lifespans.reduce((a, b) => a + b, 0) / lifespans.length)
          : null;

        return {
          total_individuals: individuals.length,
          total_families: Object.keys(data.families).length,
          average_lifespan: avg,
          oldest_person: oldestAge > 0 ? { name: oldestName, age: oldestAge } : null,
          earliest_birth_year: earliestBirth,
          latest_birth_year: latestBirth,
          individuals_with_lifespan: lifespans.length,
        };
      },
    }),

    name_frequency: tool({
      description: 'Find most common given names or surnames',
      parameters: z.object({
        type: z.enum(['given', 'surname']),
        top_n: z.number().min(1).max(50).default(10),
      }),
      execute: async ({ type, top_n }) => {
        const counts = new Map<string, number>();
        for (const ind of individuals) {
          const name = type === 'given' ? ind.name?.given : ind.name?.surname;
          if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
        }
        return Array.from(counts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, top_n)
          .map(([name, count]) => ({ name, count }));
      },
    }),

    geographic_distribution: tool({
      description: 'Find most common birthplaces',
      parameters: z.object({ top_n: z.number().min(1).max(30).default(10) }),
      execute: async ({ top_n }) => {
        const counts = new Map<string, number>();
        for (const ind of individuals) {
          const place = ind.birth?.place;
          if (place) {
            // Normalize to last part (country/state)
            const key = place.split(',').at(-1)?.trim() ?? place;
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
        }
        return Array.from(counts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, top_n)
          .map(([place, count]) => ({ place, count }));
      },
    }),
  };
}
