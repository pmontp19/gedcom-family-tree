import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseGedcom } from '@gedcom/parser';
import { buildDAG, layoutDAG, GEN_H, type GraphData } from '../src/visualization/dag-builder';
import { extractSubgraph } from '../src/visualization/subgraph-extractor';
import { NODE_W } from '../src/visualization/theme';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(here, '../../parser/tests/fixtures/gedcom70');

const ged = (...records: string[]) =>
  ['0 HEAD', '1 GEDC', '2 VERS 5.5.1', ...records, '0 TRLR'].join('\n');
const indi = (id: string, sex: string) => `0 @${id}@ INDI\n1 NAME ${id} /X/\n1 SEX ${sex}`;
const fam = (id: string, h: string, w: string, ...kids: string[]) =>
  [`0 @${id}@ FAM`, `1 HUSB @${h}@`, `1 WIFE @${w}@`, ...kids.map(k => `1 CHIL @${k}@`)].join('\n');

// A son with parents in the tree who married twice, one child per marriage.
const REMARRIED_SON = ged(
  indi('G1', 'M'), indi('G2', 'F'), indi('P', 'M'), indi('A', 'F'), indi('B', 'F'),
  indi('C1', 'M'), indi('C2', 'F'),
  fam('F1', 'G1', 'G2', 'P'), fam('F2', 'P', 'A', 'C1'), fam('F3', 'P', 'B', 'C2'),
);

function layout(text: string): GraphData {
  return layoutDAG(buildDAG(parseGedcom(text)));
}

function people(g: GraphData) {
  return new Map(g.nodes.filter(n => n.type === 'individual').map(n => [n.id, n]));
}

/** Invariants every layout must hold, whatever the family shape. */
function expectSaneLayout(g: GraphData) {
  const byId = people(g);
  for (const n of byId.values()) {
    expect(n.x, `${n.id} has x`).toBeTypeOf('number');
    expect(n.y, `${n.id} has y`).toBeTypeOf('number');
  }
  // No two cards overlap on the same row.
  const rows = new Map<number, number[]>();
  for (const n of byId.values()) rows.set(n.y!, [...(rows.get(n.y!) ?? []), n.x!]);
  for (const xs of rows.values()) {
    xs.sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(NODE_W);
  }
  for (const fam of g.families.values()) {
    const spouses = [fam.husband, fam.wife].flatMap(id => (id && byId.get(id)) || []);
    // Spouses share a row; children sit exactly one generation below.
    if (spouses.length === 2) expect(spouses[0].y).toBe(spouses[1].y);
    for (const kid of fam.children) {
      if (spouses[0] && byId.get(kid)) expect(byId.get(kid)!.y).toBe(spouses[0].y! + GEN_H);
    }
  }
}

describe('layoutDAG', () => {
  it.each(['remarriage1', 'remarriage2', 'same-sex-marriage', 'maximal70', 'minimal70'])('%s holds layout invariants', name => {
    expectSaneLayout(layout(readFileSync(join(FIXTURES, `${name}.ged`), 'utf-8')));
  });

  it('demo.ged holds layout invariants', () => {
    expectSaneLayout(layout(readFileSync(join(here, '../../../demo.ged'), 'utf-8')));
  });

  it('lays out every marriage of a remarried child, each partner next to them', () => {
    const g = layout(REMARRIED_SON);
    expectSaneLayout(g);
    const n = people(g);
    // The two partners flank P, so neither marriage bar crosses the other partner.
    const [left, right] = [n.get('A')!.x!, n.get('B')!.x!].sort((a, b) => a - b);
    expect(left).toBeLessThan(n.get('P')!.x!);
    expect(right).toBeGreaterThan(n.get('P')!.x!);
    // Each child sits on its own parents' side.
    const side = (x: number) => Math.sign(x - n.get('P')!.x!);
    expect(side(n.get('C1')!.x!)).toBe(side(n.get('A')!.x!));
    expect(side(n.get('C2')!.x!)).toBe(side(n.get('B')!.x!));
  });

  describe('around a person (hourglass)', () => {
    // Four grandparents, both parents, a remarried focus with a child per
    // marriage, the father married before too, and a grandchild.
    const FAMILY = ged(
      ...['GF1', 'GF2', 'P', 'X', 'C1', 'Z'].map(id => indi(id, 'M')),
      ...['GM1', 'GM2', 'M', 'S1', 'S2', 'PW', 'C2', 'W'].map(id => indi(id, 'F')),
      fam('F1', 'GF1', 'GM1', 'P'), fam('F2', 'GF2', 'GM2', 'M'), fam('F3', 'P', 'M', 'X'),
      fam('F4', 'P', 'PW'), fam('F5', 'X', 'S1', 'C1'), fam('F6', 'X', 'S2', 'C2'), fam('F7', 'C1', 'W', 'Z'),
    );
    const around = (text: string, id: string, gens: number) =>
      layoutDAG(buildDAG(extractSubgraph(parseGedcom(text), id, gens)), id);

    /** Families on one row keep their children in the same left-to-right order: no line crosses another. */
    function expectNoCrossings(g: GraphData) {
      const n = people(g);
      const rows = new Map<number, Array<{ x: number; kids: number[] }>>();
      for (const fam of g.families.values()) {
        const sp = [fam.husband, fam.wife].flatMap(id => (id && n.get(id)) || []);
        const kids = fam.children.flatMap(id => n.get(id)?.x ?? []);
        if (!sp.length || !kids.length) continue;
        const x = sp.reduce((s, p) => s + p.x!, 0) / sp.length;
        rows.set(sp[0].y!, [...(rows.get(sp[0].y!) ?? []), { x, kids }]);
      }
      for (const fams of rows.values()) {
        fams.sort((a, b) => a.x - b.x);
        for (let i = 1; i < fams.length; i++) {
          expect(Math.max(...fams[i - 1].kids)).toBeLessThan(Math.min(...fams[i].kids));
        }
      }
    }

    it('centres every couple over their child, partners side by side, nothing crossed', () => {
      const g = around(FAMILY, 'X', 3);
      expectSaneLayout(g);
      expectNoCrossings(g);
      const n = people(g);
      const mid = (a: string, b: string) => (n.get(a)!.x! + n.get(b)!.x!) / 2;
      expect(mid('P', 'M')).toBeCloseTo(n.get('X')!.x!);
      expect(mid('GF1', 'GM1')).toBeCloseTo(n.get('P')!.x!);
      expect(mid('GF2', 'GM2')).toBeCloseTo(n.get('M')!.x!);
      // Grandparents of each side stay on their side.
      expect(Math.max(n.get('GF1')!.x!, n.get('GM1')!.x!)).toBeLessThan(Math.min(n.get('GF2')!.x!, n.get('GM2')!.x!));
      // The father's earlier wife sits on his outer side, not between the parents.
      expect(n.get('PW')!.x!).toBeLessThan(n.get('P')!.x!);
      // Each partner of the focus right beside them.
      for (const s of ['S1', 'S2']) expect(Math.abs(n.get(s)!.x! - n.get('X')!.x!)).toBeLessThan(NODE_W * 2);
    });

    it('holds on the demo trees, whoever is in the middle', () => {
      for (const file of ['../../../demo.ged', '../../../demo-catala.ged']) {
        const text = readFileSync(join(here, file), 'utf-8');
        for (const id of parseGedcom(text).individuals.keys()) {
          const g = around(text, id, 3);
          expectSaneLayout(g);
          expectNoCrossings(g);
        }
      }
    });
  });
});
