/// <reference lib="webworker" />

import type { Family } from '@gedcom/shared';
import type { LayoutRequest, LayoutResponse, SerializableGraphData } from '@/visualization/worker-types';
import type { GraphData } from '@/visualization/dag-builder';
import { layoutDAG } from '@/visualization/dag-builder';

function toGraphData(data: SerializableGraphData): GraphData {
  return {
    nodes: data.nodes,
    links: data.links,
    families: new Map<string, Family>(data.familyEntries),
  };
}

self.onmessage = (e: MessageEvent<LayoutRequest>) => {
  const { graph, focusId, style, invert } = e.data;
  const graphData = toGraphData(graph);
  const result = layoutDAG(graphData, focusId, style, invert);

  const positions = result.nodes.map(n => ({
    id: n.id,
    x: n.x ?? 0,
    y: n.y ?? 0,
  }));

  const response: LayoutResponse = { type: 'layout-result', id: e.data.id, positions };
  self.postMessage(response);
};
