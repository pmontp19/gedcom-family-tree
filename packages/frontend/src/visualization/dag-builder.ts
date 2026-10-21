import type { GedcomData, Individual, Family } from '@gedcom/shared';
import { hierarchy, tree } from 'd3-hierarchy';
import { NODE_W, COUPLE_GAP, MEDALLION_R } from './theme';

export interface TreeNode {
  id: string;
  data: Individual | null; // null for family connector nodes
  type: 'individual' | 'family';
  familyId?: string; // For family nodes
  isAncestorStub?: boolean; // Phantom parent stub for truncated ancestors
  x?: number;
  y?: number;
}

interface TreeLink {
  source: string;
  target: string;
  type: 'marriage' | 'child' | 'ancestor-stub';
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

// Layout constants (node metrics live in ./theme)
export const GEN_H = 170;       // vertical center-to-center distance

/** A node in the layout tree. Either a family unit or a standalone individual. */
interface FamilyUnit {
  famNodeId?: string;       // undefined for standalone individuals
  indId?: string;           // defined for standalone individuals
  /** IDs of individuals that are spouses in this family */
  spouseIds: string[];
  /** Layout children: other family units formed by this family's children */
  children: FamilyUnit[];
}

/** Around a person: `hourglass` keeps each couple over its child; `crown` packs the ancestors; `painted` also lets them drift. */
export type LayoutStyle = 'hourglass' | 'crown' | 'painted';

export function layoutDAG(graph: GraphData, focusId?: string, style: LayoutStyle = 'hourglass'): GraphData {
  if (graph.nodes.length === 0) return graph;
  try {
    // A view built around someone: the hourglass, no crossings. The whole tree: the forest.
    if (focusId && graph.nodes.some(n => n.id === focusId && n.type === 'individual')) {
      return style === 'hourglass' ? layoutHourglass(graph, focusId) : layoutCrown(graph, focusId, style === 'painted');
    }
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
  // Someone who married more than once gets one unit for all their marriages,
  // partners flanking them (A, P, B, C…) and every marriage's children below,
  // so no marriage falls out of the tree.
  // ponytail: from the 3rd marriage on, the P–C bar runs behind B.
  function buildFamilyUnit(famNodeId: string, visited: Set<string>, preferredPivot?: string): FamilyUnit {
    if (visited.has(famNodeId)) return { famNodeId, spouseIds: [], children: [] };
    visited.add(famNodeId);

    const spouses = spousesOf.get(famNodeId) ?? [];
    const remarried = (id: string) => (spouseFamsOf.get(id) ?? []).some(f => f !== famNodeId && !visited.has(f));
    const pivot = preferredPivot && remarried(preferredPivot) ? preferredPivot : spouses.find(remarried);

    let famIds = [famNodeId];
    let spouseIds = spouses;
    if (pivot) {
      famIds = [famNodeId, ...(spouseFamsOf.get(pivot) ?? []).filter(f => !visited.has(f))];
      famIds.forEach(f => visited.add(f));
      const partners = famIds.map(f => (spousesOf.get(f) ?? []).find(s => s !== pivot));
      spouseIds = [partners[0], pivot, ...partners.slice(1)].filter((id): id is string => !!id);
    }

    const layoutChildren: FamilyUnit[] = [];
    for (const childId of famIds.flatMap(f => childrenOf.get(f) ?? [])) {
      const childFams = spouseFamsOf.get(childId) ?? [];
      if (childFams.length > 0) {
        // This child has their own family — recurse
        layoutChildren.push(buildFamilyUnit(childFams[0], visited, childId));
      } else {
        // Standalone child leaf
        layoutChildren.push({ indId: childId, spouseIds: [childId], children: [] });
      }
    }

    return { famNodeId, spouseIds, children: layoutChildren };
  }

  // Find root families (spouses with no parent family). A family with
  // children but no recorded parents is a root too.
  const allFamIds = graph.nodes.filter(n => n.type === 'family').map(n => n.id);
  const rootFamIds = allFamIds.filter(famId =>
    (spousesOf.get(famId) ?? []).every(s => !parentFamOf.has(s))
  );

  // Also find "orphan" individuals not in any family
  const placedIndividuals = new Set<string>();

  // Build hierarchy forest — use a SINGLE visited set so each family appears in only one tree
  const globalVisited = new Set<string>();
  const rootUnits: FamilyUnit[] = [];
  for (const id of rootFamIds) {
    // A remarried root's later marriages were already folded into its first unit.
    if (!globalVisited.has(id)) rootUnits.push(buildFamilyUnit(id, globalVisited));
  }

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
    Math.max(1, unit.spouseIds.length) * (NODE_W + COUPLE_GAP) - COUPLE_GAP;

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

        // Spread the spouses evenly around the unit centre.
        const step = NODE_W + COUPLE_GAP;
        const firstX = cx - ((unit.spouseIds.length - 1) * step) / 2;
        unit.spouseIds.forEach((id, i) => {
          const n = nodeById.get(id);
          if (n && n.x === undefined) { n.x = firstX + i * step; n.y = y; }
        });
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

  function shiftUnit(unit: FamilyUnit, dx: number, dy = 0) {
    for (const spId of unit.spouseIds) {
      const n = nodeById.get(spId);
      if (n?.x !== undefined) { n.x += dx; n.y = (n.y ?? 0) + dy; }
    }
    // Only shift family node if this unit "owns" it (not an empty stub)
    if ((unit.spouseIds.length > 0 || unit.children.length > 0) && unit.famNodeId) {
      const fn = nodeById.get(unit.famNodeId);
      if (fn?.x !== undefined) { fn.x += dx; fn.y = (fn.y ?? 0) + dy; }
    }
    unit.children.forEach(c => shiftUnit(c, dx, dy));
  }

  /** Find all stub children in a unit's subtree, paired with their immediate parent unit. */
  function findStubsWithParent(
    unit: FamilyUnit,
    result: Array<{ stubFamId: string; ownerUnit: FamilyUnit }> = []
  ): Array<{ stubFamId: string; ownerUnit: FamilyUnit }> {
    for (const child of unit.children) {
      if (child.famNodeId && child.spouseIds.length === 0 && child.children.length === 0) {
        result.push({ stubFamId: child.famNodeId, ownerUnit: unit });
      } else {
        findStubsWithParent(child, result);
      }
    }
    return result;
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

  // Reposition ancestor-only root trees so they sit directly above their stubs in the main tree
  for (const rootUnit of rootUnits) {
    const stubs = findStubsWithParent(rootUnit);
    if (stubs.length === 0) continue;

    for (const { stubFamId, ownerUnit } of stubs) {
      const stubNode = nodeById.get(stubFamId);
      const ownerFamNode = ownerUnit.famNodeId ? nodeById.get(ownerUnit.famNodeId) : undefined;
      if (!stubNode || stubNode.x === undefined || stubNode.y === undefined) continue;
      if (!ownerFamNode || ownerFamNode.x === undefined || ownerFamNode.y === undefined) continue;

      // Target: ownerUnit's family node one GEN_H above the stub
      const targetX = stubNode.x;
      const targetY = stubNode.y - GEN_H;

      const dx = targetX - ownerFamNode.x;
      const dy = targetY - ownerFamNode.y;

      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        shiftUnit(rootUnit, dx, dy);
      }
    }
  }

  // Collision resolution: iteratively push root units apart at each Y level
  {
    const nodeToRoot = new Map<string, FamilyUnit>();
    for (const ru of rootUnits) {
      const tag = (u: FamilyUnit) => { u.spouseIds.forEach(id => nodeToRoot.set(id, ru)); u.children.forEach(tag); };
      tag(ru);
    }
    const minSpacing = NODE_W + 30;
    for (let pass = 0; pass < 8; pass++) {
      const byY = new Map<number, TreeNode[]>();
      for (const node of graph.nodes) {
        if (node.type === 'individual' && node.x !== undefined && node.y !== undefined) {
          const level = Math.round(node.y / 10) * 10;
          const list = byY.get(level) ?? []; list.push(node); byY.set(level, list);
        }
      }
      let anyOverlap = false;
      for (const nodes of byY.values()) {
        nodes.sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
        for (let i = 1; i < nodes.length; i++) {
          const left = nodes[i - 1], right = nodes[i];
          const gap = (right.x ?? 0) - (left.x ?? 0);
          if (gap < minSpacing) {
            const shift = minSpacing - gap;
            const rightRoot = nodeToRoot.get(right.id);
            if (rightRoot && rightRoot !== nodeToRoot.get(left.id)) {
              shiftUnit(rightRoot, shift);
              anyOverlap = true;
            }
          }
        }
      }
      if (!anyOverlap) break;
    }
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

  // Position unpositioned spouses next to their positioned partners in the same family
  // (fixes case where secondary marriages are ignored by the layout tree)
  for (const [famNodeId, spouseIds] of spousesOf) {
    if (spouseIds.length < 2) continue;
    const positioned = spouseIds.filter(id => nodeById.get(id)?.x !== undefined);
    const unpositioned = spouseIds.filter(id => nodeById.get(id)?.x === undefined);
    if (positioned.length > 0 && unpositioned.length > 0) {
      const referenceSpouse = nodeById.get(positioned[0]);
      if (!referenceSpouse || referenceSpouse.x === undefined || referenceSpouse.y === undefined) continue;
      const refY = referenceSpouse.y;
      let nextX = referenceSpouse.x + NODE_W / 2 + COUPLE_GAP;
      for (const id of unpositioned) {
        const n = nodeById.get(id);
        if (n) {
          n.x = nextX;
          n.y = refY;
          nextX += NODE_W + COUPLE_GAP;
        }
      }
      // Reposition family node as midpoint of all spouses
      const famNode = nodeById.get(famNodeId);
      if (famNode) {
        const allXs = spouseIds.map(id => nodeById.get(id)?.x).filter((x): x is number => x !== undefined);
        if (allXs.length > 0) {
          famNode.x = allXs.reduce((a, b) => a + b, 0) / allXs.length;
          famNode.y = refY;
        }
      }
    }
  }

  // Resolve collisions for secondary spouses: if they overlap with existing nodes, push them apart
  const minSpacing = NODE_W + 30;
  for (let pass = 0; pass < 4; pass++) {
    const byY = new Map<number, TreeNode[]>();
    for (const node of graph.nodes) {
      if (node.type === 'individual' && node.x !== undefined && node.y !== undefined) {
        const level = Math.round(node.y / 10) * 10;
        const list = byY.get(level) ?? [];
        list.push(node);
        byY.set(level, list);
      }
    }
    let anyCollision = false;
    for (const nodes of byY.values()) {
      nodes.sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
      for (let i = 1; i < nodes.length; i++) {
        const left = nodes[i - 1], right = nodes[i];
        const gap = (right.x ?? 0) - (left.x ?? 0);
        if (gap < minSpacing) {
          const shift = minSpacing - gap;
          if (right.x !== undefined) {
            right.x += shift;
            anyCollision = true;
          }
        }
      }
    }
    if (!anyCollision) break;
  }

  // Update family node positions after collision resolution
  for (const [famNodeId, spouseIds] of spousesOf) {
    if (spouseIds.length < 1) continue;
    const famNode = nodeById.get(famNodeId);
    if (!famNode) continue;
    const xs = spouseIds.map(id => nodeById.get(id)?.x).filter((x): x is number => x !== undefined);
    if (xs.length > 0) {
      famNode.x = xs.reduce((a, b) => a + b, 0) / xs.length;
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

/**
 * Layout around one person, the way pedigree charts are drawn: ancestors
 * fan out above, each couple centred over their child; descendants spread
 * below, each family's children under their parents. Lines cannot cross by
 * construction. Anyone outside both trees (a partner's other partners)
 * goes beside the person they married.
 */
export function layoutHourglass(graph: GraphData, focusId: string): GraphData {
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]));
  const isPerson = (id?: string) => !!id && nodeById.get(id)?.type === 'individual';
  const push = (m: Map<string, string[]>, k: string, v: string) => m.set(k, [...(m.get(k) ?? []), v]);

  const spousesOf = new Map<string, string[]>();  // famNodeId -> spouses
  const childrenOf = new Map<string, string[]>(); // famNodeId -> children
  const famsOf = new Map<string, string[]>();     // person -> famNodeIds as spouse
  const famcOf = new Map<string, string>();       // person -> famNodeId as child
  for (const link of graph.links) {
    if (link.type === 'marriage' && isPerson(link.source)) {
      push(spousesOf, link.target, link.source);
      push(famsOf, link.source, link.target);
    } else if (link.type === 'child' && isPerson(link.target)) {
      push(childrenOf, link.source, link.target);
      if (!famcOf.has(link.target)) famcOf.set(link.target, link.source);
    }
  }
  const partnerIn = (fam: string, id: string) => (spousesOf.get(fam) ?? []).find(s => s !== id);

  const SLOT = NODE_W + COUPLE_GAP; // centre to centre within a couple
  const GAP = 40;                   // between unrelated neighbours
  const placed = new Set<string>();
  const put = (id: string, x: number, y: number) => {
    const n = nodeById.get(id)!;
    n.x = x; n.y = y;
    placed.add(id);
  };

  // ── Descendants: a person, their partners in a row, each marriage's children below.
  interface Unit { row: string[]; kids: Unit[]; width: number; rowWidth: number }
  const claimed = new Set<string>();
  function unit(id: string): Unit {
    claimed.add(id);
    const fams = famsOf.get(id) ?? [];
    const partners = fams.map(f => partnerIn(f, id));
    for (const p of partners) if (p) claimed.add(p);
    // First partner on the left, later ones on the right: every couple stays side by side.
    const row = [partners[0], id, ...partners.slice(1)].filter((p): p is string => !!p);
    const kids: Unit[] = [];
    for (const f of fams) {
      for (const c of childrenOf.get(f) ?? []) if (!claimed.has(c)) kids.push(unit(c));
    }
    const rowWidth = row.length * SLOT - COUPLE_GAP;
    const kidsWidth = kids.reduce((s, k) => s + k.width, 0) + GAP * Math.max(0, kids.length - 1);
    return { row, kids, rowWidth, width: Math.max(rowWidth, kidsWidth) };
  }
  function placeDown(u: Unit, cx: number, y: number) {
    const x0 = cx - u.rowWidth / 2 + NODE_W / 2;
    u.row.forEach((id, i) => put(id, x0 + i * SLOT, y));
    let left = cx - (u.kids.reduce((s, k) => s + k.width, 0) + GAP * Math.max(0, u.kids.length - 1)) / 2;
    for (const k of u.kids) {
      placeDown(k, left + k.width / 2, y + GEN_H);
      left += k.width + GAP;
    }
  }

  // ── Ancestors: parents centred over their child, each side's own ancestors over them.
  // A parent's other marriages sit on the outer side (a father's to the left,
  // a mother's to the right), except a partner who is the other parent's
  // sibling (a widower marrying his wife's sister): next to that sibling.
  // Room is measured on each side separately.
  const extraPartners = (id: string, fam: string) =>
    (famsOf.get(id) ?? []).filter(f => f !== fam).map(f => partnerIn(f, id)).filter((p): p is string => !!p);
  function outerPartners(fam: string): { left: string[]; right: string[] } {
    const [h, w] = spousesOf.get(fam) ?? [];
    const siblingOf = (p: string, of?: string) => !!of && !!famcOf.get(p) && famcOf.get(p) === famcOf.get(of);
    const hx = h ? extraPartners(h, fam) : [], wx = w ? extraPartners(w, fam) : [];
    if (!w) return { left: [], right: hx }; // a lone parent: their other partners to the right
    return {
      left: [...hx.filter(p => !siblingOf(p, w)), ...wx.filter(p => siblingOf(p, h))],
      right: [...wx.filter(p => !siblingOf(p, h)), ...hx.filter(p => siblingOf(p, w))],
    };
  }
  type Reach = { left: number; right: number }; // from the person's centre
  const reachMemo = new Map<string, Reach>();
  function reach(id: string): Reach {
    const memo = reachMemo.get(id);
    if (memo) return memo;
    const r: Reach = { left: NODE_W / 2, right: NODE_W / 2 };
    reachMemo.set(id, r); // a loop in bad data ends here
    const fam = famcOf.get(id);
    const parents = fam ? spousesOf.get(fam) ?? [] : [];
    if (!fam || parents.length === 0) return r;
    const outer = outerPartners(fam);
    if (parents.length >= 2) {
      const h = reach(parents[0]), w = reach(parents[1]);
      const d = Math.max(SLOT, h.right + GAP + w.left);
      r.left = Math.max(r.left, d / 2 + Math.max(h.left, NODE_W / 2 + outer.left.length * SLOT));
      r.right = Math.max(r.right, d / 2 + Math.max(w.right, NODE_W / 2 + outer.right.length * SLOT));
    } else {
      const only = reach(parents[0]);
      r.left = Math.max(r.left, only.left);
      r.right = Math.max(r.right, only.right, NODE_W / 2 + outer.right.length * SLOT);
    }
    return r;
  }
  function placeUp(id: string) {
    const fam = famcOf.get(id);
    const self = nodeById.get(id);
    if (!fam || self?.x === undefined || self.y === undefined) return;
    const parents = (spousesOf.get(fam) ?? []).filter(p => !placed.has(p));
    if (parents.length === 0) return;
    const y = self.y - GEN_H;
    const sx = self.x;
    const outer = outerPartners(fam);
    let leftX = sx, rightX = sx;
    if (parents.length >= 2) {
      const [h, w] = parents;
      const d = Math.max(SLOT, reach(h).right + GAP + reach(w).left);
      leftX = sx - d / 2; rightX = sx + d / 2;
      put(h, leftX, y);
      put(w, rightX, y);
    } else {
      put(parents[0], sx, y);
    }
    outer.left.forEach((p, i) => { if (!placed.has(p)) put(p, leftX - (i + 1) * SLOT, y); });
    outer.right.forEach((p, i) => { if (!placed.has(p)) put(p, rightX + (i + 1) * SLOT, y); });
    for (const p of parents) placeUp(p);
  }

  // Brothers and sisters share the focus's row, in birth order, each with
  // their own family below; the focus stays at x = 0.
  const focusUnit = unit(focusId);
  const famc = famcOf.get(focusId);
  const units = (famc ? childrenOf.get(famc) ?? [] : [focusId])
    .map(id => id === focusId ? focusUnit : claimed.has(id) ? null : unit(id))
    .filter((u): u is Unit => !!u);
  const before = units.slice(0, units.indexOf(focusUnit)).reduce((s, u) => s + u.width + GAP, 0);
  let left = -before - focusUnit.width / 2;
  for (const u of units) {
    placeDown(u, left + u.width / 2, 0);
    left += u.width + GAP;
  }
  placeUp(focusId);

  // ── Leftovers (a partner's other partners): beside whoever they married, on a free side.
  const occupied = (x: number, y: number) => graph.nodes.some(n =>
    n.type === 'individual' && placed.has(n.id) && n.y === y && Math.abs((n.x ?? 0) - x) < NODE_W + 10);
  let spare = 0;
  const below = Math.max(0, ...graph.nodes.filter(n => placed.has(n.id)).map(n => n.y ?? 0)) + 2 * GEN_H;
  for (const n of graph.nodes) {
    if (n.type !== 'individual' || placed.has(n.id)) continue;
    const mate = (famsOf.get(n.id) ?? []).map(f => partnerIn(f, n.id)).map(p => p && nodeById.get(p))
      .find(m => m && placed.has(m.id));
    if (mate && mate.x !== undefined && mate.y !== undefined) {
      for (let k = 1; ; k++) {
        const x = [mate.x - k * SLOT, mate.x + k * SLOT].find(cand => !occupied(cand, mate.y!));
        if (x !== undefined) { put(n.id, x, mate.y); break; }
      }
    } else {
      put(n.id, spare, below); // unconnected to anyone placed: a row of their own, below
      spare += NODE_W + GAP;
    }
  }

  // Families sit between their spouses (or over their children when nobody is placed).
  for (const n of graph.nodes) {
    if (n.type !== 'family') continue;
    const sp = (spousesOf.get(n.id) ?? []).map(id => nodeById.get(id)!).filter(s => s.x !== undefined);
    const kids = (childrenOf.get(n.id) ?? []).map(id => nodeById.get(id)!).filter(k => k.x !== undefined);
    if (sp.length) {
      n.x = sp.reduce((s, p) => s + p.x!, 0) / sp.length;
      n.y = sp[0].y;
    } else if (kids.length) {
      n.x = kids.reduce((s, k) => s + k.x!, 0) / kids.length;
      n.y = kids[0].y! - GEN_H;
    } else {
      n.x = 0; n.y = 0;
    }
  }
  return graph;
}

/**
 * Layout around one person, grown like the painted 1974 tree: the hourglass
 * below and on the person's row, but the ancestors packed into a crown. Each
 * couple's parents are fitted level by level against their neighbours (a
 * tidy tree) instead of keeping a column as wide as their whole ancestry, so
 * the tree is far narrower and a couple may lean a little off its child.
 * `organic` adds a hand-placed unevenness: rows break, couples drift.
 */
export function layoutCrown(graph: GraphData, focusId: string, organic = false): GraphData {
  layoutHourglass(graph, focusId);
  // Medallions are narrower than cards: a painted crown packs them closer.
  const SLOT = organic ? 2 * MEDALLION_R + 22 : NODE_W + COUPLE_GAP;
  const ITEM = organic ? 2 * MEDALLION_R : NODE_W;
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]));
  const spousesOf = new Map<string, string[]>();
  const famsOf = new Map<string, string[]>();
  const famcOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  const push = (m: Map<string, string[]>, k: string, v: string) => m.set(k, [...(m.get(k) ?? []), v]);
  for (const link of graph.links) {
    const isPerson = (id: string) => nodeById.get(id)?.type === 'individual';
    if (link.type === 'marriage' && isPerson(link.source)) {
      push(spousesOf, link.target, link.source);
      push(famsOf, link.source, link.target);
    } else if (link.type === 'child' && isPerson(link.target)) {
      push(childrenOf, link.source, link.target);
      if (!famcOf.has(link.target)) famcOf.set(link.target, link.source);
    }
  }

  // A couple of ancestors, their other partners on the outer sides; above
  // them, the couples that are each one's parents.
  interface Couple { members: string[]; width: number; above: Couple[] }
  const seen = new Set<string>();
  const used = new Set<string>(); // someone in two couples (a widow remarried in the line) sits once
  const above = (y: number) => (id: string) => (nodeById.get(id)?.y ?? 0) < y;
  function couple(fam: string): Couple | null {
    if (seen.has(fam)) return null; // the same ancestors reached twice: drawn once
    seen.add(fam);
    const [h, w] = spousesOf.get(fam) ?? [];
    if (!h) return null;
    const others = (id?: string) => (id ? famsOf.get(id) ?? [] : []).filter(f => f !== fam)
      .flatMap(f => spousesOf.get(f) ?? []).filter(p => p !== id && above(0)(p));
    const members = [...others(h), h, ...(w ? [w] : []), ...others(w)].filter(p => !used.has(p) && !!used.add(p));
    const ups = [h, w].flatMap(p => (p && famcOf.get(p)) || []).map(couple).filter((c): c is Couple => !!c);
    return { members, width: (members.length - 1) * SLOT + ITEM, above: ups };
  }
  const rootFam = famcOf.get(focusId);
  const root = rootFam ? couple(rootFam) : null;
  if (root) {
    const h = hierarchy(root, c => c.above);
    tree<Couple>().nodeSize([1, GEN_H])
      .separation((a, b) => (a.data.width + b.data.width) / 2 + (organic ? 26 : 40))(h);
    // Centre the crown over the brothers and sisters it grows from.
    const row = (childrenOf.get(rootFam!) ?? []).map(id => nodeById.get(id)?.x).filter((x): x is number => x !== undefined);
    const shift = (row.length ? (Math.min(...row) + Math.max(...row)) / 2 : 0) - h.x!;
    for (const d of h.descendants()) {
      const left = d.x! + shift - (d.data.members.length - 1) * SLOT / 2;
      d.data.members.forEach((id, i) => {
        const n = nodeById.get(id)!;
        n.x = left + i * SLOT;
        n.y = -(d.depth + 1) * GEN_H;
      });
    }
  }

  if (organic) {
    // Stable per person: the same tree always grows the same way.
    const wobble = (id: string, salt: number) => {
      let s = salt;
      for (const ch of id) s = (s * 31 + ch.charCodeAt(0)) % 9973;
      return (s / 9973) * 2 - 1;
    };
    for (const fam of spousesOf.keys()) {
      const sp = (spousesOf.get(fam) ?? []).map(id => nodeById.get(id)!).filter(n => (n.y ?? 0) < 0);
      const dy = wobble(fam, 7) * GEN_H * 0.16; // a couple drifts together
      for (const n of sp) { n.y! += dy; n.x! += wobble(n.id, 3) * 12; }
    }
  }

  for (const n of graph.nodes) {
    if (n.type !== 'family') continue;
    const sp = (spousesOf.get(n.id) ?? []).map(id => nodeById.get(id)!).filter(s => s.x !== undefined);
    if (sp.length) {
      n.x = sp.reduce((s, p) => s + p.x!, 0) / sp.length;
      n.y = sp.reduce((s, p) => s + p.y!, 0) / sp.length;
    }
  }
  return graph;
}
