import { describe, it, expect } from 'vitest';
import { toResult } from '../src/services/gedlint';

const RULES = [
  {
    code: 'E201',
    name: 'broken-reference',
    title: 'Point only at records that exist in the same file',
    why: 'The link is lost on import.',
    remedy: 'Add the record or drop the pointer.',
  },
];

const RAW = {
  summary: { errors: 1, warnings: 0, infos: 0 },
  diagnostics: [
    { code: 'E201', severity: 'ERROR', line: 33, message: '@F1@: HUSB @I9@ points to a nonexistent INDI' },
    { code: 'W999', severity: 'WARN', line: 2, message: 'unknown rule' },
  ],
  groups: [
    { code: 'E201', severity: 'ERROR', count: 1, example: '@F1@: HUSB @I9@ points to a nonexistent INDI' },
    { code: 'W999', severity: 'WARN', count: 2, example: 'unknown rule' },
  ],
};

describe('toResult', () => {
  it('maps engine severities to the UI ones', () => {
    const result = toResult(RAW, RULES);
    expect(result.diagnostics.map((d) => d.severity)).toEqual(['error', 'warning']);
  });

  it('folds the rule catalogue into the groups', () => {
    const [known] = toResult(RAW, RULES).groups;
    expect(known.rule_name).toBe('broken-reference');
    expect(known.title).toBe('Point only at records that exist in the same file');
    expect(known.remedy).toContain('drop the pointer');
  });

  it('falls back to the example when the rule is not in the catalogue', () => {
    const unknown = toResult(RAW, RULES).groups[1];
    expect(unknown.rule_name).toBe('W999');
    expect(unknown.title).toBe('unknown rule');
    expect(unknown.why).toBe('');
  });
});
