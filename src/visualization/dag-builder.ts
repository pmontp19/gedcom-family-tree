import type { GedcomData, Individual, Family } from '@/models';
import { graphStratify, sugiyama } from 'd3-dag';

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

  // Create nodes for all individuals
  for (const ind of data.individuals.values()) {
    nodes.push({
      id: ind.id,
      data: ind,
      type: 'individual',
    });
  }

  // Create family connector nodes and links
  for (const fam of data.families.values()) {
    if (!fam.husband && !fam.wife && fam.children.length === 0) continue;

    const famNodeId = `FAM_${fam.id}`;
    families.set(famNodeId, fam);

    // Create invisible family connector node
    nodes.push({
      id: famNodeId,
      data: null,
      type: 'family',
      familyId: fam.id,
    });

    // Link spouses to family node
    if (fam.husband) {
      links.push({ source: fam.husband, target: famNodeId, type: 'marriage' });
    }
    if (fam.wife) {
      links.push({ source: fam.wife, target: famNodeId, type: 'marriage' });
    }

    // Link family node to children
    for (const childId of fam.children) {
      links.push({ source: famNodeId, target: childId, type: 'child' });
    }
  }

  return { nodes, links, families };
}

export function layoutDAG(graph: GraphData): GraphData {
  if (graph.nodes.length === 0) return graph;

  // Build parent relationships for d3-dag stratify
  const childToParents = new Map<string, string[]>();

  for (const link of graph.links) {
    if (!childToParents.has(link.target)) {
      childToParents.set(link.target, []);
    }
    childToParents.get(link.target)!.push(link.source);
  }

  const stratifyData = graph.nodes.map(node => ({
    id: node.id,
    parentIds: childToParents.get(node.id) || [],
  }));

  try {
    const dag = graphStratify()(stratifyData);
    const layout = sugiyama()
      .nodeSize([180, 120])
      .gap([40, 60]);

    layout(dag);

    // Update node positions
    const nodePositions = new Map<string, { x: number; y: number }>();
    for (const node of dag.nodes()) {
      nodePositions.set(node.data.id, { x: node.x, y: node.y });
    }

    for (const node of graph.nodes) {
      const pos = nodePositions.get(node.id);
      if (pos) {
        node.x = pos.x;
        node.y = pos.y;
      }
    }
  } catch (e) {
    console.warn('Layout failed, using fallback:', e);
    // Fallback: simple grid layout
    const cols = Math.ceil(Math.sqrt(graph.nodes.length));
    graph.nodes.forEach((node, i) => {
      node.x = (i % cols) * 180;
      node.y = Math.floor(i / cols) * 120;
    });
  }

  return graph;
}
