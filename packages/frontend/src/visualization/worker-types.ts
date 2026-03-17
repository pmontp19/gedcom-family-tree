import type { Individual, Family } from '@gedcom/shared';

export interface SerializableTreeNode {
  id: string;
  data: Individual | null;
  type: 'individual' | 'family';
  familyId?: string;
  x?: number;
  y?: number;
}

export interface SerializableTreeLink {
  source: string;
  target: string;
  type: 'marriage' | 'child' | 'ancestor-stub';
}

export interface SerializableGraphData {
  nodes: SerializableTreeNode[];
  links: SerializableTreeLink[];
  familyEntries: [string, Family][];
}

export interface NodePosition {
  id: string;
  x: number;
  y: number;
}

export interface LayoutRequest {
  type: 'layout';
  graph: SerializableGraphData;
}

export interface LayoutResponse {
  type: 'layout-result';
  positions: NodePosition[];
}
