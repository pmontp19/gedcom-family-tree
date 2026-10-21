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
  // Records people point at; shared, not filtered, so citations still resolve.
  result.sources = data.sources;
  result.notes = data.notes;

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
    if (!ind?.famc?.length) return;

    for (const famcId of ind.famc) {
      const fam = data.families.get(famcId);
      if (!fam) continue;
      addFamily(famcId);
      if (fam.husband) {
        addWithSpouses(fam.husband);
        walkUp(fam.husband, gen + 1);
      }
      if (fam.wife) {
        addWithSpouses(fam.wife);
        walkUp(fam.wife, gen + 1);
      }
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
/**
 * Someone's whole tree: every ancestor, and everyone descending from their
 * parents, so brothers and sisters come along. Cousins' branches stay out:
 * the full file would lay out as one long, flat strip.
 */
export function extractFamilyTree(data: GedcomData, id: string): GedcomData {
  const parents = (data.individuals.get(id)?.famc ?? [])
    .flatMap(f => [data.families.get(f)?.husband, data.families.get(f)?.wife])
    .filter((p): p is string => !!p);
  const result = createGedcomData();
  result.header = data.header;
  result.sources = data.sources;
  result.notes = data.notes;
  for (const from of parents.length ? parents : [id]) {
    const part = extractSubgraph(data, from, Infinity);
    for (const [k, v] of part.individuals) result.individuals.set(k, v);
    for (const [k, v] of part.families) result.families.set(k, v);
  }
  return result;
}

/**
 * The direct line from someone up to one of their ancestors: each generation's
 * couple and nothing else. Null when the ancestor is not theirs.
 */
export function extractLineage(data: GedcomData, fromId: string, toId: string): GedcomData | null {
  // BFS up the parents: the shortest line wins when cousins married.
  const via = new Map<string, { child: string; fam: string } | null>([[fromId, null]]);
  const queue = [fromId];
  while (queue.length && !via.has(toId)) {
    const id = queue.shift()!;
    for (const famId of data.individuals.get(id)?.famc ?? []) {
      const fam = data.families.get(famId);
      for (const parent of [fam?.husband, fam?.wife]) {
        if (parent && !via.has(parent)) { via.set(parent, { child: id, fam: famId }); queue.push(parent); }
      }
    }
  }
  if (!via.has(toId)) return null;

  const result = createGedcomData();
  result.header = data.header;
  result.sources = data.sources;
  result.notes = data.notes;
  const addInd = (id?: string) => { const ind = id && data.individuals.get(id); if (ind) result.individuals.set(ind.id, ind); };
  addInd(fromId);
  for (let step = via.get(toId); step; step = via.get(step.child)) {
    const fam = data.families.get(step.fam)!;
    // Only the child on the line: their siblings would widen every row.
    result.families.set(fam.id, { ...fam, children: [step.child] });
    addInd(fam.husband);
    addInd(fam.wife);
  }
  return result;
}

/**
 * The tree without some people, as if they were never in it: their own
 * records and any family left with nobody but one spouse go too. Records are
 * copied where touched, never mutated: the full tree stays as it was.
 */
export function withoutPeople(data: GedcomData, ids: Iterable<string>): GedcomData {
  const hidden = new Set(ids);
  if (hidden.size === 0) return data;
  const result: GedcomData = { ...data, individuals: new Map(), families: new Map() };
  const gone = new Set<string>();

  for (const [id, fam] of data.families) {
    const husband = fam.husband && !hidden.has(fam.husband) ? fam.husband : undefined;
    const wife = fam.wife && !hidden.has(fam.wife) ? fam.wife : undefined;
    const children = fam.children.filter(c => !hidden.has(c));
    if (children.length === 0 && !(husband && wife)) { gone.add(id); continue; }
    result.families.set(id, husband === fam.husband && wife === fam.wife && children.length === fam.children.length
      ? fam : { ...fam, husband, wife, children });
  }
  for (const [id, ind] of data.individuals) {
    if (hidden.has(id)) continue;
    const touched = ind.fams.some(f => gone.has(f)) || ind.famc.some(f => gone.has(f));
    result.individuals.set(id, touched
      ? { ...ind, fams: ind.fams.filter(f => !gone.has(f)), famc: ind.famc.filter(f => !gone.has(f)) }
      : ind);
  }
  return result;
}
