import { describe, it } from 'vitest';
import { readFileSync } from 'fs';
import { parseGedcom } from '@gedcom/parser';
import { buildDAG, layoutDAG } from './src/visualization/dag-builder.js';
import { extractSubgraph } from './src/visualization/subgraph-extractor.js';

describe('stub positions', () => {
  it('lists stubs + neighbours', () => {
    const ged = readFileSync('/Users/pere/Genealogia-Montpeo/arbre/Montpeo_arbre_netejat.ged', 'utf-8');
    const data = parseGedcom(ged);
    const view = extractSubgraph(data, 'I2', 4);
    console.log('view inds:', view.individuals.size, [...view.individuals.keys()].join(','));
    console.log('view fams:', view.families.size, [...view.families.keys()].join(','));
    const graph = layoutDAG(buildDAG(view));

    const hiddenFamGroups = new Map<string, string[]>();
    for (const node of graph.nodes) {
      if (node.type !== 'individual' || !node.data) continue;
      for (const famcId of node.data.famc ?? []) {
        if (view.families.get(famcId)) continue;
        const g = hiddenFamGroups.get(famcId) ?? [];
        g.push(node.id);
        hiddenFamGroups.set(famcId, g);
      }
    }
    const byId = new Map(graph.nodes.map(n => [n.id, n]));
    for (const [famId, indIds] of hiddenFamGroups) {
      const children = indIds.map(id => byId.get(id)!).filter(Boolean);
      const xs = children.map(c => c.x ?? 0);
      const midX = xs.reduce((a,b)=>a+b,0)/xs.length;
      const minY = Math.min(...children.map(c => c.y ?? 0));
      console.log(`STUB ${famId} kids=[${indIds}] at (${midX.toFixed(0)}, ${(minY-140).toFixed(0)})`);
    }
    // FAM nodes with positions (not drawn but positioned)
    for (const n of graph.nodes) {
      if (n.type === 'family' && !n.isAncestorStub && n.x !== undefined) {
        console.log(`FAMNODE ${n.id} at (${n.x.toFixed(0)}, ${n.y?.toFixed(0)})`);
      }
    }
  });
});
