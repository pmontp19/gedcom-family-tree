import { describe, it, expect } from 'vitest';
import { parseDate, formatGedcomDate, MONTHS } from '@/parser/utils/date-parser';

describe('date-parser', () => {
  describe('parseDate', () => {
    it('parses full date', () => {
      const result = parseDate('7 JAN 1964');
      expect(result).toEqual({
        day: 7,
        month: 1,
        year: 1964,
      });
    });

    it('parses year only', () => {
      const result = parseDate('1958');
      expect(result).toEqual({
        year: 1958,
      });
    });

    it('parses month and year', () => {
      const result = parseDate('JUN 1991');
      expect(result).toEqual({
        month: 6,
        year: 1991,
      });
    });

    it('parses ABT qualifier', () => {
      const result = parseDate('ABT 1958');
      expect(result).toEqual({
        qualifier: 'ABT',
        year: 1958,
      });
    });

    it('parses EST qualifier', () => {
      const result = parseDate('EST 1920');
      expect(result).toEqual({
        qualifier: 'EST',
        year: 1920,
      });
    });

    it('parses CAL qualifier', () => {
      const result = parseDate('CAL 1900');
      expect(result).toEqual({
        qualifier: 'CAL',
        year: 1900,
      });
    });

    it('parses BEF qualifier', () => {
      const result = parseDate('BEF 1950');
      expect(result).toEqual({
        qualifier: 'BEF',
        year: 1950,
      });
    });

    it('parses AFT qualifier', () => {
      const result = parseDate('AFT 1960');
      expect(result).toEqual({
        qualifier: 'AFT',
        year: 1960,
      });
    });

    it('parses BET range', () => {
      const result = parseDate('BET 1900 AND 1910');
      expect(result).toEqual({
        qualifier: 'BET',
        year: 1900,
        endDate: {
          year: 1910,
        },
      });
    });

    it('parses date with qualifier', () => {
      const result = parseDate('ABT 18 DEC 1951');
      expect(result).toEqual({
        qualifier: 'ABT',
        day: 18,
        month: 12,
        year: 1951,
      });
    });

    it('handles empty string', () => {
      const result = parseDate('');
      expect(result).toEqual({});
    });

    it('handles invalid input', () => {
      const result = parseDate('invalid');
      expect(result.text).toBe('invalid');
    });
  });

  describe('MONTHS constant', () => {
    it('has all months', () => {
      expect(MONTHS.JAN).toBe(1);
      expect(MONTHS.DEC).toBe(12);
    });
  });

  describe('formatGedcomDate', () => {
    it('formats full date', () => {
      const result = formatGedcomDate({ day: 7, month: 1, year: 1964 });
      expect(result).toBe('7 JAN 1964');
    });

    it('formats year only', () => {
      const result = formatGedcomDate({ year: 1958 });
      expect(result).toBe('1958');
    });

    it('formats with qualifier', () => {
      const result = formatGedcomDate({ qualifier: 'ABT', year: 1958 });
      expect(result).toBe('ABT 1958');
    });

    it('returns empty for undefined', () => {
      const result = formatGedcomDate(undefined);
      expect(result).toBe('');
    });
  });
});
