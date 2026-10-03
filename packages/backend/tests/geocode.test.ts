import { describe, it, expect } from 'vitest';
import { icgcQuery } from '../src/tools/geocode.js';

describe('icgcQuery', () => {
  it('asks the ICGC for the name when the place is Catalan or says nothing else', () => {
    expect(icgcQuery('Vilanova de Bellpuig, Lleida, Catalunya')).toBe('Vilanova de Bellpuig');
    expect(icgcQuery('Sant Martí de Provençals, Barcelona')).toBe('Sant Martí de Provençals');
    expect(icgcQuery('Lérida, Cataluña, España')).toBe('Lérida');
    expect(icgcQuery('Sabadell')).toBe('Sabadell');
  });

  it('leaves places elsewhere to OpenStreetMap', () => {
    expect(icgcQuery('Cork, Ireland')).toBeNull();
    expect(icgcQuery('Austin, Texas, USA')).toBeNull();
    expect(icgcQuery(' , ')).toBeNull();
  });
});
