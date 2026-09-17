import { tool } from 'ai';
import { z } from 'zod';
import type { SerializedGedcomData } from '@gedcom/shared';
import { getSerializedIndividual, getSerializedParents, getSerializedChildren, getSerializedSpouses, getSerializedSiblings, toPersonRef } from '@gedcom/shared';

export function traversalTools(data: SerializedGedcomData) {
  return {
    get_parents: tool({
      description: 'Get the fathers and mothers of an individual (supports adoption)',
      inputSchema: z.object({ individual_id: z.string() }),
      execute: async ({ individual_id }) => {
        const { fathers, mothers } = getSerializedParents(data, individual_id);
        return {
          fathers: fathers.map(toPersonRef),
          mothers: mothers.map(toPersonRef),
        };
      },
    }),

    get_children: tool({
      description: 'Get all children of an individual',
      inputSchema: z.object({ individual_id: z.string() }),
      execute: async ({ individual_id }) => {
        return getSerializedChildren(data, individual_id).map(toPersonRef);
      },
    }),

    get_spouses: tool({
      description: 'Get all spouses of an individual',
      inputSchema: z.object({ individual_id: z.string() }),
      execute: async ({ individual_id }) => {
        return getSerializedSpouses(data, individual_id).map(toPersonRef);
      },
    }),

    get_siblings: tool({
      description: 'Get all siblings of an individual',
      inputSchema: z.object({ individual_id: z.string() }),
      execute: async ({ individual_id }) => {
        return getSerializedSiblings(data, individual_id).map(toPersonRef);
      },
    }),

    get_ancestors: tool({
      description: 'Get ancestors up to N generations (1=parents, 2=grandparents, etc.)',
      inputSchema: z.object({
        individual_id: z.string(),
        generations: z.number().min(1).max(8).default(3),
      }),
      execute: async ({ individual_id, generations }) => {
        const results: Array<ReturnType<typeof toPersonRef> & { generation: number; relation: string }> = [];
        const queue: Array<{ id: string; gen: number; relation: string }> = [
          { id: individual_id, gen: 0, relation: 'self' },
        ];

        const visited = new Set<string>();

        while (queue.length > 0) {
          const { id, gen, relation } = queue.shift()!;
          if (gen === 0) {
            const { fathers, mothers } = getSerializedParents(data, id);
            for (const father of fathers) {
              if (!visited.has(father.id)) {
                visited.add(father.id);
                const r = gen + 1 === 1 ? 'Father' : `${gen + 1}x Great-Grandfather`;
                results.push({ ...toPersonRef(father), generation: gen + 1, relation: relation === 'self' ? 'Father' : r });
                queue.push({ id: father.id, gen: gen + 1, relation: 'father' });
              }
            }
            for (const mother of mothers) {
              if (!visited.has(mother.id)) {
                visited.add(mother.id);
                results.push({ ...toPersonRef(mother), generation: gen + 1, relation: relation === 'self' ? 'Mother' : 'Grandmother' });
                queue.push({ id: mother.id, gen: gen + 1, relation: 'mother' });
              }
            }
          } else if (gen < generations) {
            const { fathers, mothers } = getSerializedParents(data, id);
            const genLabel = gen === 1 ? 'Grand' : gen === 2 ? 'Great-Grand' : `${gen - 1}x Great-Grand`;
            for (const father of fathers) {
              if (!visited.has(father.id)) {
                visited.add(father.id);
                results.push({ ...toPersonRef(father), generation: gen + 1, relation: `${genLabel}father` });
                queue.push({ id: father.id, gen: gen + 1, relation: 'father' });
              }
            }
            for (const mother of mothers) {
              if (!visited.has(mother.id)) {
                visited.add(mother.id);
                results.push({ ...toPersonRef(mother), generation: gen + 1, relation: `${genLabel}mother` });
                queue.push({ id: mother.id, gen: gen + 1, relation: 'mother' });
              }
            }
          }
        }

        return results;
      },
    }),

    get_descendants: tool({
      description: 'Get descendants up to N generations (1=children, 2=grandchildren, etc.)',
      inputSchema: z.object({
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

          for (const child of getSerializedChildren(data, id)) {
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
      inputSchema: z.object({ individual_id: z.string() }),
      execute: async ({ individual_id }) => {
        const ind = getSerializedIndividual(data, individual_id);
        if (!ind) return null;

        // Get families as child (support multiple for adoption)
        const fathers: ReturnType<typeof toPersonRef>[] = [];
        const mothers: ReturnType<typeof toPersonRef>[] = [];
        let marriageYear: number | null = null;

        for (const famcId of ind.famc || []) {
          const fam = data.families[famcId];
          if (fam) {
            if (fam.husband) fathers.push(toPersonRef(data.individuals[fam.husband]!));
            if (fam.wife) mothers.push(toPersonRef(data.individuals[fam.wife]!));
            if (fam.marriage?.date?.year) marriageYear = fam.marriage.date.year;
          }
        }

        // Get siblings (from all famc families)
        const siblings = getSerializedSiblings(data, individual_id).map(toPersonRef);

        return { individual: toPersonRef(ind), fathers, mothers, siblings, marriage_year: marriageYear };
      },
    }),
  };
}