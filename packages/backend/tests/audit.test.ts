import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { auditGedcom, explainRule } from '../src/tools/audit.js';

const BIN = process.env.GEDLINT_BIN ?? '/Users/pere/Developer/gedlint/target/release/gedlint';
const hasBinary = existsSync(BIN);

// A file that trips a few rules: broken HUSB pointer and a death before birth.
const BROKEN_GED = `0 HEAD
1 GEDC
2 VERS 5.5.1
1 CHAR UTF-8
0 @I1@ INDI
1 NAME Maria /Rovira/
1 SEX F
1 BIRT
2 DATE 12 MAR 1901
1 DEAT
2 DATE 1899
0 @F1@ FAM
1 HUSB @I9@
1 CHIL @I1@
0 TRLR
`;

describe.skipIf(!hasBinary)('gedlint audit tools', () => {
  it('reports the broken reference and the impossible lifespan', async () => {
    const report = await auditGedcom(BROKEN_GED);
    expect(report.version).toBe('5.5.1');
    expect(report.summary.errors).toBeGreaterThan(0);
    const codes = report.diagnostics.map((d) => d.code);
    expect(codes).toContain('E201'); // HUSB @I9@ points nowhere
    expect(codes).toContain('W301'); // died before being born
  });

  it('keeps the original bytes, so encoding rules still fire', async () => {
    // The MyHeritage bug: "é" split across a CONC boundary. Decoding the file
    // to a string before linting would quietly repair it and hide E101.
    const split = Buffer.concat([
      Buffer.from('0 HEAD\n1 GEDC\n2 VERS 5.5.1\n1 CHAR UTF-8\n0 @I1@ INDI\n1 NAME Jos'),
      Buffer.from([0xc3]),
      Buffer.from('\n2 CONC '),
      Buffer.from([0xa9]),
      Buffer.from(' /Oso/\n0 TRLR\n'),
    ]);
    const report = await auditGedcom(split);
    expect(report.diagnostics.map((d) => d.code)).toContain('E101');
  });

  it('explains a rule with its why and remedy', async () => {
    const text = await explainRule('E201');
    expect(text).toContain('WHY');
    expect(text).toContain('REMEDY');
  });

  it('refuses a code that could be read as a flag', async () => {
    await expect(explainRule('--version')).rejects.toThrow('invalid rule code');
  });
});
