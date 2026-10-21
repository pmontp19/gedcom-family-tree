import type { LayoutStyle } from './dag-builder';
import type { Individual, Family } from '@gedcom/shared';

interface SerializableTreeNode {
  id: string;
  data: Individual | null;
  type: 'individual' | 'family';
  familyId?: string;
  x?: number;
  y?: number;
}

interface SerializableTreeLink {
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
  id: number;
  graph: SerializableGraphData;
  /** Lay out around this person (hourglass) instead of the whole forest. */
  focusId?: string;
  style?: LayoutStyle;
  invert?: boolean;
}

export interface LayoutResponse {
  type: 'layout-result';
  id: number;
  positions: NodePosition[];
}
