import type { GedcomData } from '@gedcom/shared';
import { createGedcomData } from '@gedcom/shared';

/**
 * BFS from a focus person, walking N generations up (ancestors) and down (descendants).
 * Includes spouses at every level. Returns a new GedcomData with only touched individuals/families.
 */
export function extractSubgraph(
  data: GedcomData,
  focusId: string,
  maxGenerations: number,
): GedcomData {
  const result = createGedcomData();
  result.header = data.header;

  const visitedInds = new Set<string>();
  const visitedFams = new Set<string>();

  function addIndividual(id: string) {
    if (visitedInds.has(id)) return;
    const ind = data.individuals.get(id);
    if (!ind) return;
    visitedInds.add(id);
    result.individuals.set(id, ind);
  }

  function addFamily(id: string) {
    if (visitedFams.has(id)) return;
    const fam = data.families.get(id);
    if (!fam) return;
    visitedFams.add(id);
    result.families.set(id, fam);
  }

  /** Add person and all their spouses (+ the family connecting them) */
  function addWithSpouses(id: string) {
    addIndividual(id);
    const ind = data.individuals.get(id);
    if (!ind) return;
    for (const famId of ind.fams) {
      const fam = data.families.get(famId);
      if (!fam) continue;
      addFamily(famId);
      if (fam.husband) addIndividual(fam.husband);
      if (fam.wife) addIndividual(fam.wife);
    }
  }

  // Walk ancestors (up via famc)
  function walkUp(id: string, gen: number) {
    if (gen > maxGenerations) return;
    const ind = data.individuals.get(id);
    if (!ind?.famc) return;
    const fam = data.families.get(ind.famc);
    if (!fam) return;
    addFamily(ind.famc);
    if (fam.husband) {
      addWithSpouses(fam.husband);
      walkUp(fam.husband, gen + 1);
    }
    if (fam.wife) {
      addWithSpouses(fam.wife);
      walkUp(fam.wife, gen + 1);
    }
  }

  // Walk descendants (down via fams → children)
  function walkDown(id: string, gen: number) {
    if (gen > maxGenerations) return;
    const ind = data.individuals.get(id);
    if (!ind) return;
    for (const famId of ind.fams) {
      const fam = data.families.get(famId);
      if (!fam) continue;
      addFamily(famId);
      // Add spouse
      if (fam.husband) addWithSpouses(fam.husband);
      if (fam.wife) addWithSpouses(fam.wife);
      for (const childId of fam.children) {
        addWithSpouses(childId);
        walkDown(childId, gen + 1);
      }
    }
  }

  addWithSpouses(focusId);
  walkUp(focusId, 1);
  walkDown(focusId, 1);

  return result;
}
