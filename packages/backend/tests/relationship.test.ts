import { describe, it, expect } from 'vitest';
import { describeRelationship } from '../src/tools/relationship.js';

describe('describeRelationship (what A is to B)', () => {
  it.each([
    [0, 0, 'same person'],
    [0, 1, 'parent'], [0, 2, 'grandparent'], [0, 3, 'great-grandparent'],
    [0, 4, 'great-great-grandparent'], [0, 6, '4x great-grandparent'],
    [1, 0, 'child'], [3, 0, 'great-grandchild'],
    [1, 1, 'sibling'],
    [1, 2, 'aunt/uncle'], [1, 3, 'great-aunt/uncle'],
    [2, 1, 'niece/nephew'], [3, 1, 'great-niece/nephew'],
    [2, 2, '1st cousin'], [3, 3, '2nd cousin'], [5, 5, '4th cousin'], [12, 12, '11th cousin'],
    [2, 3, '1st cousin 1x removed'], [4, 2, '1st cousin 2x removed'],
  ])('(%i, %i) is %s', (a, b, expected) => {
    expect(describeRelationship(a, b)).toBe(expected);
  });
});
