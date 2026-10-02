import type { GedcomData, Individual, Family } from '@gedcom/shared';

/**
 * Children of the person's own parent families, then half-siblings: children
 * a parent had in another family, tagged with the parent they share.
 */
export function findSiblings(ind: Individual, data: GedcomData): Array<{ id: string; via?: string }> {
  const seen = new Set([ind.id]);
  const result: Array<{ id: string; via?: string }> = [];
  const add = (id: string, via?: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    result.push({ id, via });
  };

  const own = ind.famc.map(id => data.families.get(id)).filter((f): f is Family => !!f);
  for (const fam of own) fam.children.forEach(id => add(id));
  for (const fam of own) {
    for (const [parentId, via] of [[fam.husband, 'de pare'], [fam.wife, 'de mare']] as const) {
      const parent = parentId ? data.individuals.get(parentId) : undefined;
      for (const otherId of parent?.fams ?? []) {
        if (ind.famc.includes(otherId)) continue;
        data.families.get(otherId)?.children.forEach(id => add(id, via));
      }
    }
  }
  return result;
}
