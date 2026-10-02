import { describe, it, expect } from 'vitest';
import { parseGedcom } from '@gedcom/parser';
import { findSiblings } from '../src/services/relatives';

// P married A (child C1) and B (child C2); C1 also has a full brother C3.
const data = parseGedcom([
  '0 HEAD',
  '0 @P@ INDI', '0 @A@ INDI', '0 @B@ INDI', '0 @C1@ INDI', '0 @C2@ INDI', '0 @C3@ INDI',
  '0 @F1@ FAM', '1 HUSB @P@', '1 WIFE @A@', '1 CHIL @C1@', '1 CHIL @C3@',
  '0 @F2@ FAM', '1 HUSB @P@', '1 WIFE @B@', '1 CHIL @C2@',
  '0 TRLR',
].join('\n'));

describe('findSiblings', () => {
  it('lists full siblings first, then half-siblings tagged with the shared parent', () => {
    expect(findSiblings(data.individuals.get('C1')!, data)).toEqual([
      { id: 'C3', via: undefined },
      { id: 'C2', via: 'de pare' },
    ]);
  });

  it('is empty for someone without parents', () => {
    expect(findSiblings(data.individuals.get('P')!, data)).toEqual([]);
  });
});
