import { tool } from 'ai';
import { z } from 'zod';
import type { GedcomData } from '../types.js';
import { getIndividual, getParents, getChildren, getSpouses, getSiblings, toPersonRef } from '../types.js';

export function traversalTools(data: GedcomData) {
  return {
    get_parents: tool({
      description: 'Get the father and mother of an individual',
      parameters: z.object({ individual_id: z.string() }),
      execute: async ({ individual_id }) => {
        const { father, mother } = getParents(data, individual_id);
        return {
          father: father ? toPersonRef(father) : null,
          mother: mother ? toPersonRef(mother) : null,
        };
      },
    }),

    get_children: tool({
      description: 'Get all children of an individual',
      parameters: z.object({ individual_id: z.string() }),
      execute: async ({ individual_id }) => {
        return getChildren(data, individual_id).map(toPersonRef);
      },
    }),

    get_spouses: tool({
      description: 'Get all spouses of an individual',
      parameters: z.object({ individual_id: z.string() }),
      execute: async ({ individual_id }) => {
        return getSpouses(data, individual_id).map(toPersonRef);
      },
    }),

    get_siblings: tool({
      description: 'Get all siblings of an individual',
      parameters: z.object({ individual_id: z.string() }),
      execute: async ({ individual_id }) => {
        return getSiblings(data, individual_id).map(toPersonRef);
      },
    }),

    get_ancestors: tool({
      description: 'Get ancestors up to N generations (1=parents, 2=grandparents, etc.)',
      parameters: z.object({
        individual_id: z.string(),
        generations: z.number().min(1).max(8).default(3),
      }),
      execute: async ({ individual_id, generations }) => {
        const results: Array<ReturnType<typeof toPersonRef> & { generation: number; relation: string }> = [];
        const queue: Array<{ id: string; gen: number; relation: string }> = [
          { id: individual_id, gen: 0, relation: 'self' },
        ];

        const relationLabels: Record<number, string[]> = {
          1: ['Father', 'Mother'],
          2: ['Paternal Grandfather', 'Paternal Grandmother', 'Maternal Grandfather', 'Maternal Grandmother'],
        };

        const visited = new Set<string>();

        while (queue.length > 0) {
          const { id, gen, relation } = queue.shift()!;
          if (gen === 0) {
            const { father, mother } = getParents(data, id);
            if (father && !visited.has(father.id)) {
              visited.add(father.id);
              const r = gen + 1 === 1 ? 'Father' : `${gen + 1}x Great-Grandfather`;
              results.push({ ...toPersonRef(father), generation: gen + 1, relation: relation === 'self' ? 'Father' : r });
              queue.push({ id: father.id, gen: gen + 1, relation: 'father' });
            }
            if (mother && !visited.has(mother.id)) {
              visited.add(mother.id);
              results.push({ ...toPersonRef(mother), generation: gen + 1, relation: relation === 'self' ? 'Mother' : 'Grandmother' });
              queue.push({ id: mother.id, gen: gen + 1, relation: 'mother' });
            }
          } else if (gen < generations) {
            const { father, mother } = getParents(data, id);
            const genLabel = gen === 1 ? 'Grand' : gen === 2 ? 'Great-Grand' : `${gen - 1}x Great-Grand`;
            if (father && !visited.has(father.id)) {
              visited.add(father.id);
              results.push({ ...toPersonRef(father), generation: gen + 1, relation: `${genLabel}father` });
              queue.push({ id: father.id, gen: gen + 1, relation: 'father' });
            }
            if (mother && !visited.has(mother.id)) {
              visited.add(mother.id);
              results.push({ ...toPersonRef(mother), generation: gen + 1, relation: `${genLabel}mother` });
              queue.push({ id: mother.id, gen: gen + 1, relation: 'mother' });
            }
          }
        }

        void relationLabels;
        return results;
      },
    }),

    get_descendants: tool({
      description: 'Get descendants up to N generations (1=children, 2=grandchildren, etc.)',
      parameters: z.object({
        individual_id: z.string(),
        generations: z.number().min(1).max(6).default(2),
      }),
      execute: async ({ individual_id, generations }) => {
        const results: Array<ReturnType<typeof toPersonRef> & { generation: number; relation: string }> = [];
        const queue: Array<{ id: string; gen: number }> = [{ id: individual_id, gen: 0 }];
        const visited = new Set<string>();

        while (queue.length > 0) {
          const { id, gen } = queue.shift()!;
          if (gen >= generations) continue;

          for (const child of getChildren(data, id)) {
            if (visited.has(child.id)) continue;
            visited.add(child.id);
            const genLabel = gen === 0 ? 'Child' : gen === 1 ? 'Grandchild' : gen === 2 ? 'Great-Grandchild' : `${gen - 1}x Great-Grandchild`;
            results.push({ ...toPersonRef(child), generation: gen + 1, relation: genLabel });
            queue.push({ id: child.id, gen: gen + 1 });
          }
        }

        return results;
      },
    }),

    get_family_group: tool({
      description: 'Get a family unit: parents and children for a given individual',
      parameters: z.object({ individual_id: z.string() }),
      execute: async ({ individual_id }) => {
        const ind = getIndividual(data, individual_id);
        if (!ind) return null;

        // Get family as child
        let father = null, mother = null, marriageYear = null;
        if (ind.famc) {
          const fam = data.families[ind.famc];
          if (fam) {
            if (fam.husband) father = toPersonRef(data.individuals[fam.husband]!);
            if (fam.wife) mother = toPersonRef(data.individuals[fam.wife]!);
            marriageYear = fam.marriage?.date?.year ?? null;
          }
        }

        // Get siblings
        const siblings = getSiblings(data, individual_id).map(toPersonRef);

        return { individual: toPersonRef(ind), father, mother, siblings, marriage_year: marriageYear };
      },
    }),
  };
}
