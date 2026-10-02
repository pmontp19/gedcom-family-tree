import { describe, it, expect } from 'vitest';
import { formatDateLong, getLifeYears, createIndividual } from '../src/index.js';

describe('formatDateLong (Catalan)', () => {
  it.each([
    [{ day: 20, month: 6, year: 1975 }, '20 de juny de 1975'],
    [{ day: 1, month: 4, year: 1801 }, "1 d'abril de 1801"],
    [{ month: 10, year: 1900 }, "octubre de 1900"],
    [{ year: 1820, qualifier: 'ABT' as const }, 'cap a 1820'],
    [{ year: 1820, qualifier: 'BEF' as const }, 'abans de 1820'],
    [{ year: 1700, qualifier: 'BET' as const, endDate: { year: 1710 } }, 'entre 1700 i 1710'],
    [{ year: 1720, qualifier: 'FROM' as const, endDate: { year: 1730 } }, 'de 1720 a 1730'],
    [{ text: 'Desconeguda' }, 'Desconeguda'],
  ])('%j → %s', (date, expected) => {
    expect(formatDateLong(date)).toBe(expected);
  });
});

describe('getLifeYears', () => {
  it('abbreviates in Catalan', () => {
    const ind = createIndividual('I1');
    ind.birth = { type: 'BIRT', date: { year: 1950 } };
    expect(getLifeYears(ind)).toBe('n. 1950');
    ind.death = { type: 'DEAT', date: { year: 2020 } };
    expect(getLifeYears(ind)).toBe('1950–2020');
  });
});
