import { tool } from 'ai';
import { z } from 'zod';
import type { GedcomData, Individual } from '../types.js';
import { getIndividual, getParents, toPersonRef } from '../types.js';

function buildAncestorMap(data: GedcomData, id: string, maxGen = 10): Map<string, number> {
  const map = new Map<string, number>();
  const queue: Array<{ id: string; gen: number }> = [{ id, gen: 0 }];
  while (queue.length > 0) {
    const { id: cur, gen } = queue.shift()!;
    if (map.has(cur) || gen > maxGen) continue;
    map.set(cur, gen);
    if (gen < maxGen) {
      const { father, mother } = getParents(data, cur);
      if (father) queue.push({ id: father.id, gen: gen + 1 });
      if (mother) queue.push({ id: mother.id, gen: gen + 1 });
    }
  }
  return map;
}

function describeRelationship(genA: number, genB: number): string {
  if (genA === 0 && genB === 1) return 'parent';
  if (genA === 1 && genB === 0) return 'child';
  if (genA === 1 && genB === 1) return 'sibling';
  if (genA === 0 && genB === 2) return 'grandparent';
  if (genA === 2 && genB === 0) return 'grandchild';
  if (genA === 1 && genB === 2) return 'aunt/uncle';
  if (genA === 2 && genB === 1) return 'niece/nephew';
  if (genA === 2 && genB === 2) return '1st cousin';
  if (genA === 3 && genB === 3) return '2nd cousin';
  if (genA === 4 && genB === 4) return '3rd cousin';

  const minGen = Math.min(genA, genB);
  const diff = Math.abs(genA - genB);

  if (minGen >= 2) {
    const cousinNum = minGen - 1;
    const removed = diff;
    const suffix = cousinNum === 1 ? '1st' : cousinNum === 2 ? '2nd' : cousinNum === 3 ? '3rd' : `${cousinNum}th`;
    if (removed === 0) return `${suffix} cousin`;
    return `${suffix} cousin ${removed}x removed`;
  }

  return `distant relative (${genA} up, ${genB} down)`;
}

function buildPathToAncestor(
  data: GedcomData,
  fromId: string,
  ancestorId: string,
  maxGen: number
): Individual[] | null {
  const queue: Array<{ id: string; path: Individual[] }> = [
    { id: fromId, path: [getIndividual(data, fromId)!] },
  ];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    if (id === ancestorId) return path;
    if (path.length > maxGen + 1 || visited.has(id)) continue;
    visited.add(id);

    const { father, mother } = getParents(data, id);
    if (father && !visited.has(father.id)) queue.push({ id: father.id, path: [...path, father] });
    if (mother && !visited.has(mother.id)) queue.push({ id: mother.id, path: [...path, mother] });
  }
  return null;
}

export function relationshipTools(data: GedcomData) {
  return {
    find_relationship: tool({
      description: 'Find how two individuals are related and the path between them',
      parameters: z.object({
        individual_id_a: z.string(),
        individual_id_b: z.string(),
      }),
      execute: async ({ individual_id_a, individual_id_b }) => {
        const ancestorsA = buildAncestorMap(data, individual_id_a);
        const ancestorsB = buildAncestorMap(data, individual_id_b);

        // Find common ancestors
        let bestAncestor: string | null = null;
        let bestGenA = Infinity, bestGenB = Infinity;

        for (const [id, genA] of ancestorsA) {
          if (ancestorsB.has(id)) {
            const genB = ancestorsB.get(id)!;
            if (genA + genB < bestGenA + bestGenB) {
              bestAncestor = id;
              bestGenA = genA;
              bestGenB = genB;
            }
          }
        }

        if (!bestAncestor) {
          return { relationship: 'not related', path: [] };
        }

        const relationship = describeRelationship(bestGenA, bestGenB);
        const ancestor = getIndividual(data, bestAncestor)!;

        // Build path: A → ancestor → B
        const pathA = buildPathToAncestor(data, individual_id_a, bestAncestor, bestGenA) ?? [];
        const pathB = buildPathToAncestor(data, individual_id_b, bestAncestor, bestGenB) ?? [];

        const fullPath = [
          ...pathA,
          ...pathB.slice(1).reverse(), // B's path reversed (from ancestor down to B)
        ];

        return {
          relationship,
          common_ancestor: toPersonRef(ancestor),
          gen_from_a: bestGenA,
          gen_from_b: bestGenB,
          path: fullPath.map((ind, i) => ({
            name: ind.name?.full ?? ind.id,
            relation_to_next: i < fullPath.length - 1 ? 'ancestor' : null,
          })),
        };
      },
    }),

    find_common_ancestors: tool({
      description: 'Find all common ancestors between two individuals',
      parameters: z.object({
        individual_id_a: z.string(),
        individual_id_b: z.string(),
      }),
      execute: async ({ individual_id_a, individual_id_b }) => {
        const ancestorsA = buildAncestorMap(data, individual_id_a);
        const ancestorsB = buildAncestorMap(data, individual_id_b);

        const common: Array<{ ancestor: ReturnType<typeof toPersonRef>; gen_from_a: number; gen_from_b: number }> = [];

        for (const [id, genA] of ancestorsA) {
          if (ancestorsB.has(id) && id !== individual_id_a && id !== individual_id_b) {
            const ind = getIndividual(data, id);
            if (ind) common.push({ ancestor: toPersonRef(ind), gen_from_a: genA, gen_from_b: ancestorsB.get(id)! });
          }
        }

        return common.sort((a, b) => (a.gen_from_a + a.gen_from_b) - (b.gen_from_a + b.gen_from_b)).slice(0, 10);
      },
    }),
  };
}
