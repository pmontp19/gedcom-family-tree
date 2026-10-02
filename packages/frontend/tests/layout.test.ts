import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseGedcom } from '@gedcom/parser';
import { buildDAG, layoutDAG, GEN_H, type GraphData } from '../src/visualization/dag-builder';
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
});
