import type { GedcomData, Individual, Family } from '@gedcom/shared';
import { hierarchy, tree } from 'd3-hierarchy';

export interface TreeNode {
  id: string;
  data: Individual | null; // null for family connector nodes
  type: 'individual' | 'family';
  familyId?: string; // For family nodes
  x?: number;
  y?: number;
}

export interface TreeLink {
  source: string;
  target: string;
  type: 'marriage' | 'child';
}

export interface GraphData {
  nodes: TreeNode[];
  links: TreeLink[];
  families: Map<string, Family>;
}

export function buildDAG(data: GedcomData): GraphData {
  const nodes: TreeNode[] = [];
  const links: TreeLink[] = [];
  const families = new Map<string, Family>();

  for (const ind of data.individuals.values()) {
    nodes.push({ id: ind.id, data: ind, type: 'individual' });
  }

  for (const fam of data.families.values()) {
    if (!fam.husband && !fam.wife && fam.children.length === 0) continue;
    const famNodeId = `FAM_${fam.id}`;
    families.set(famNodeId, fam);
    nodes.push({ id: famNodeId, data: null, type: 'family', familyId: fam.id });

    if (fam.husband) links.push({ source: fam.husband, target: famNodeId, type: 'marriage' });
    if (fam.wife) links.push({ source: fam.wife, target: famNodeId, type: 'marriage' });
    for (const childId of fam.children) {
      links.push({ source: famNodeId, target: childId, type: 'child' });
    }
  }

  return { nodes, links, families };
}

// Layout constants matching TreeNode component
const NODE_W = 160;
const COUPLE_GAP = 10;   // gap between spouses
const GEN_H = 140;       // vertical center-to-center distance

/** A node in the layout tree. Either a family unit or a standalone individual. */
interface FamilyUnit {
  famNodeId?: string;       // undefined for standalone individuals
  indId?: string;           // defined for standalone individuals
  /** IDs of individuals that are spouses in this family */
  spouseIds: string[];
  /** Layout children: other family units formed by this family's children */
  children: FamilyUnit[];
}

export function layoutDAG(graph: GraphData): GraphData {
  if (graph.nodes.length === 0) return graph;
  try {
    return layoutFamilyTree(graph);
  } catch (e) {
    console.error('Family tree layout failed, using grid fallback:', e);
    const cols = Math.ceil(Math.sqrt(graph.nodes.filter(n => n.type === 'individual').length));
    let i = 0;
    for (const node of graph.nodes) {
      if (node.type === 'individual') {
        node.x = (i % cols) * 200;
        node.y = Math.floor(i / cols) * 140;
        i++;
      } else {
        node.x = 0; node.y = 0;
      }
    }
    return graph;
  }
}

function layoutFamilyTree(graph: GraphData): GraphData {

  const nodeById = new Map(graph.nodes.map(n => [n.id, n]));

  // Build indices
  const spousesOf = new Map<string, string[]>();   // famNodeId -> [spouseIds]
  const childrenOf = new Map<string, string[]>();  // famNodeId -> [childIds]
  const parentFamOf = new Map<string, string>();   // indId -> famNodeId (child role)
  const spouseFamsOf = new Map<string, string[]>(); // indId -> [famNodeIds] (spouse role)

  for (const link of graph.links) {
    if (link.type === 'marriage') {
      const list = spousesOf.get(link.target) ?? [];
      list.push(link.source);
      spousesOf.set(link.target, list);
      const fams = spouseFamsOf.get(link.source) ?? [];
      fams.push(link.target);
      spouseFamsOf.set(link.source, fams);
    } else {
      const list = childrenOf.get(link.source) ?? [];
      list.push(link.target);
      childrenOf.set(link.source, list);
      parentFamOf.set(link.target, link.source);
    }
  }

  // Build family units tree
  // Each family's "layout children" are the families formed by their children.
  // Children who have no own family become standalone FamilyUnit leaves.
  function buildFamilyUnit(famNodeId: string, visited = new Set<string>()): FamilyUnit {
    if (visited.has(famNodeId)) return { famNodeId, spouseIds: [], children: [] };
    visited.add(famNodeId);

    const spouseIds = spousesOf.get(famNodeId) ?? [];
    const children = childrenOf.get(famNodeId) ?? [];

    const layoutChildren: FamilyUnit[] = [];
    for (const childId of children) {
      const childFams = spouseFamsOf.get(childId) ?? [];
      if (childFams.length > 0) {
        // This child has their own family — recurse
        const unit = buildFamilyUnit(childFams[0], visited);
        layoutChildren.push(unit);
      } else {
        // Standalone child leaf
        layoutChildren.push({ indId: childId, spouseIds: [childId], children: [] });
      }
    }

    return { famNodeId, spouseIds, children: layoutChildren };
  }

  // Find root families (spouses with no parent family)
  const allFamIds = [...spousesOf.keys()];
  const rootFamIds = allFamIds.filter(famId =>
    (spousesOf.get(famId) ?? []).every(s => !parentFamOf.has(s))
  );

  // Also find "orphan" individuals not in any family
  const placedIndividuals = new Set<string>();

  // Build hierarchy forest — use a SINGLE visited set so each family appears in only one tree
  const globalVisited = new Set<string>();
  const rootUnits: FamilyUnit[] = rootFamIds.map(id => buildFamilyUnit(id, globalVisited));

  // Collect individuals already in rootUnits (to find truly orphaned ones)
  function collectInds(unit: FamilyUnit, set: Set<string>) {
    unit.spouseIds.forEach(id => set.add(id));
    if (unit.indId) set.add(unit.indId);
    unit.children.forEach(c => collectInds(c, set));
  }
  rootUnits.forEach(u => collectInds(u, placedIndividuals));

  // Use d3-hierarchy tree layout for each root
  // Node size: couple unit = (2*NODE_W + COUPLE_GAP), single = NODE_W
  // We lay each root tree independently then place them side by side
  const unitWidth = (unit: FamilyUnit) =>
    unit.spouseIds.length >= 2 ? 2 * NODE_W + COUPLE_GAP : NODE_W;

  function layoutTree(root: FamilyUnit): void {
    const hier = hierarchy<FamilyUnit>(root, d => d.children.length > 0 ? d.children : null);

    // Use a custom Reingold-Tilford layout
    // We use d3 tree with separation based on node widths
    const treeLayout = tree<FamilyUnit>()
      .nodeSize([1, GEN_H])  // unit x-size; we'll scale after
      .separation((a, b) => {
        const aw = unitWidth(a.data);
        const bw = unitWidth(b.data);
        const gap = 30;
        // normalized gap between adjacent nodes
        return (aw / 2 + bw / 2 + gap) / NODE_W;
      });

    treeLayout(hier);

    // Scale x from normalized units to pixels and assign positions
    hier.each(node => {
      const unit = node.data;
      const cx = (node.x ?? 0) * NODE_W; // scale by NODE_W
      const y = (node.depth ?? 0) * GEN_H;

      if (unit.famNodeId) {
        const famNode = nodeById.get(unit.famNodeId);
        if (famNode && famNode.x === undefined) { famNode.x = cx; famNode.y = y; }

        const spouses = unit.spouseIds;
        if (spouses.length >= 2) {
          const n1 = nodeById.get(spouses[0]);
          const n2 = nodeById.get(spouses[1]);
          if (n1 && n1.x === undefined) { n1.x = cx - COUPLE_GAP / 2 - NODE_W / 2; n1.y = y; }
          if (n2 && n2.x === undefined) { n2.x = cx + COUPLE_GAP / 2 + NODE_W / 2; n2.y = y; }
        } else if (spouses.length === 1) {
          const n = nodeById.get(spouses[0]);
          if (n && n.x === undefined) { n.x = cx; n.y = y; }
        }
      } else if (unit.indId) {
        const n = nodeById.get(unit.indId);
        if (n && n.x === undefined) { n.x = cx; n.y = y; }
      }
    });
  }

  function getUnitBounds(unit: FamilyUnit): { minX: number; maxX: number } {
    let minX = Infinity, maxX = -Infinity;
    const visit = (u: FamilyUnit) => {
      // Only count individual nodes (spouseIds), not family nodes — family nodes from
      // visited subtrees could have been placed by a different root and corrupt bounds.
      for (const spId of u.spouseIds) {
        const n = nodeById.get(spId);
        if (n?.x !== undefined) { minX = Math.min(minX, n.x - NODE_W / 2); maxX = Math.max(maxX, n.x + NODE_W / 2); }
      }
      u.children.forEach(visit);
    };
    visit(unit);
    return { minX, maxX };
  }

  function shiftUnit(unit: FamilyUnit, shift: number) {
    for (const spId of unit.spouseIds) {
      const n = nodeById.get(spId);
      if (n?.x !== undefined) n.x += shift;
    }
    // Only shift family node if this unit "owns" it (has spouses — non-empty unit)
    if (unit.spouseIds.length > 0 && unit.famNodeId) {
      const fn = nodeById.get(unit.famNodeId);
      if (fn?.x !== undefined) fn.x += shift;
    }
    unit.children.forEach(c => shiftUnit(c, shift));
  }

  // Layout each root tree and offset them side by side
  let offsetX = 0;
  for (const rootUnit of rootUnits) {
    layoutTree(rootUnit);
    const { minX, maxX } = getUnitBounds(rootUnit);
    if (minX === Infinity) continue;

    shiftUnit(rootUnit, offsetX - minX);
    offsetX += (maxX - minX) + 60;
  }

  // Recompute family node X as midpoint of actual spouse positions
  // (fixes lateral marriages where one spouse was placed by a different subtree)
  for (const [famNodeId, spouseIds] of spousesOf) {
    if (spouseIds.length < 1) continue;
    const famNode = nodeById.get(famNodeId);
    if (!famNode) continue;
    const xs = spouseIds.map(id => nodeById.get(id)?.x).filter((x): x is number => x !== undefined);
    if (xs.length > 0) {
      famNode.x = xs.reduce((a, b) => a + b, 0) / xs.length;
      // Use the Y of the first spouse
      const firstSpouse = nodeById.get(spouseIds[0]);
      if (firstSpouse?.y !== undefined) famNode.y = firstSpouse.y;
    }
  }

  // Place any remaining unpositioned nodes
  let fallbackX = offsetX;
  for (const node of graph.nodes) {
    if (node.x === undefined) {
      node.x = fallbackX + NODE_W / 2;
      node.y = 0;
      fallbackX += NODE_W + 30;
    }
  }

  return graph;
}
