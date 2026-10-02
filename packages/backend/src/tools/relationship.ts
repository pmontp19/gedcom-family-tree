import { tool } from 'ai';
import { z } from 'zod';
import type { SerializedGedcomData, SerializedIndividual } from '@gedcom/shared';
import { getSerializedIndividual, getSerializedParents, toPersonRef } from '@gedcom/shared';

function buildAncestorMap(data: SerializedGedcomData, id: string, maxGen = 10): Map<string, number> {
  const map = new Map<string, number>();
  const queue: Array<{ id: string; gen: number }> = [{ id, gen: 0 }];
  while (queue.length > 0) {
    const { id: cur, gen } = queue.shift()!;
    if (map.has(cur) || gen > maxGen) continue;
    map.set(cur, gen);
    if (gen < maxGen) {
      const { fathers, mothers } = getSerializedParents(data, cur);
      for (const parent of [...fathers, ...mothers]) {
        queue.push({ id: parent.id, gen: gen + 1 });
      }
    }
  }
  return map;
}

/** "great-" repeated, then "Nx great-" once it gets hard to count. */
function greats(n: number): string {
  return n <= 0 ? '' : n <= 2 ? 'great-'.repeat(n) : `${n}x great-`;
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

/**
 * What A is to B, given how many generations each sits below their closest
 * common ancestor (0 means that person is the ancestor).
 */
export function describeRelationship(genA: number, genB: number): string {
  if (genA === 0 && genB === 0) return 'same person';
  if (genA === 0) return genB === 1 ? 'parent' : `${greats(genB - 2)}grandparent`;
  if (genB === 0) return genA === 1 ? 'child' : `${greats(genA - 2)}grandchild`;
  if (genA === 1 && genB === 1) return 'sibling';
  if (genA === 1) return `${greats(genB - 2)}aunt/uncle`;
  if (genB === 1) return `${greats(genA - 2)}niece/nephew`;

  const cousin = `${ordinal(Math.min(genA, genB) - 1)} cousin`;
  const removed = Math.abs(genA - genB);
  return removed === 0 ? cousin : `${cousin} ${removed}x removed`;
}

function buildPathToAncestor(
  data: SerializedGedcomData,
  fromId: string,
  ancestorId: string,
  maxGen: number
): SerializedIndividual[] | null {
  const queue: Array<{ id: string; path: SerializedIndividual[] }> = [
    { id: fromId, path: [getSerializedIndividual(data, fromId)!] },
  ];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    if (id === ancestorId) return path;
    if (path.length > maxGen + 1 || visited.has(id)) continue;
    visited.add(id);

    const { fathers, mothers } = getSerializedParents(data, id);
    for (const parent of [...fathers, ...mothers]) {
      if (!visited.has(parent.id)) queue.push({ id: parent.id, path: [...path, parent] });
    }
  }
  return null;
}

export function relationshipTools(data: SerializedGedcomData) {
  return {
    find_relationship: tool({
      description: 'Find how two individuals are related and the path between them',
      inputSchema: z.object({
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
        const ancestor = getSerializedIndividual(data, bestAncestor)!;

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
            // Up from A to the common ancestor, then down to B.
            relation_to_next: i >= fullPath.length - 1 ? null : i < pathA.length - 1 ? 'parent' : 'child',
          })),
        };
      },
    }),

    find_common_ancestors: tool({
      description: 'Find all common ancestors between two individuals',
      inputSchema: z.object({
        individual_id_a: z.string(),
        individual_id_b: z.string(),
      }),
      execute: async ({ individual_id_a, individual_id_b }) => {
        const ancestorsA = buildAncestorMap(data, individual_id_a);
        const ancestorsB = buildAncestorMap(data, individual_id_b);

        const common: Array<{ ancestor: ReturnType<typeof toPersonRef>; gen_from_a: number; gen_from_b: number }> = [];

        for (const [id, genA] of ancestorsA) {
          if (ancestorsB.has(id) && id !== individual_id_a && id !== individual_id_b) {
            const ind = getSerializedIndividual(data, id);
            if (ind) common.push({ ancestor: toPersonRef(ind), gen_from_a: genA, gen_from_b: ancestorsB.get(id)! });
          }
        }

        return common.sort((a, b) => (a.gen_from_a + a.gen_from_b) - (b.gen_from_a + b.gen_from_b)).slice(0, 10);
      },
    }),
  };
}
