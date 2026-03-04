import { describe, it, expect } from 'vitest';
import { tokenize, tokenizeLines, type Token } from '@/parser/tokenizer';

describe('tokenizer', () => {
  describe('basic lines', () => {
    it('parses simple tag line', () => {
      const result = tokenize('0 HEAD');
      expect(result).toEqual<Token>({
        level: 0,
        tag: 'HEAD',
        pointer: undefined,
        data: undefined,
      });
    });

    it('parses line with data', () => {
      const result = tokenize('1 NAME John /Doe/');
      expect(result).toEqual<Token>({
        level: 1,
        tag: 'NAME',
        pointer: undefined,
        data: 'John /Doe/',
      });
    });

    it('parses line with pointer', () => {
      const result = tokenize('0 @I1@ INDI');
      expect(result).toEqual<Token>({
        level: 0,
        tag: 'INDI',
        pointer: 'I1',
        data: undefined,
      });
    });

    it('parses family reference', () => {
      const result = tokenize('1 FAMC @F7@');
      expect(result).toEqual<Token>({
        level: 1,
        tag: 'FAMC',
        pointer: undefined,
        data: '@F7@',
      });
    });

    it('parses level 2 line', () => {
      const result = tokenize('2 GIVN Ramon');
      expect(result).toEqual<Token>({
        level: 2,
        tag: 'GIVN',
        pointer: undefined,
        data: 'Ramon',
      });
    });
  });

  describe('UTF-8 / special characters', () => {
    it('preserves Catalan characters', () => {
      const result = tokenize('2 SURN Ossó, Sendrós');
      expect(result.data).toBe('Ossó, Sendrós');
    });

    it('preserves special characters in names', () => {
      const result = tokenize('1 NAME Mª Rosa /Ossó, Sendrós/');
      expect(result.data).toBe('Mª Rosa /Ossó, Sendrós/');
    });

    it('handles email with escaped @', () => {
      const result = tokenize('2 EMAIL peremontpeo@@gmail.com');
      expect(result.data).toBe('peremontpeo@@gmail.com');
    });
  });

  describe('edge cases', () => {
    it('handles empty data', () => {
      const result = tokenize('1 DEAT Y');
      expect(result).toEqual<Token>({
        level: 1,
        tag: 'DEAT',
        pointer: undefined,
        data: 'Y',
      });
    });

    it('handles custom tags', () => {
      const result = tokenize('1 _UID 67DB3F217EF0942BE0242809057258A8');
      expect(result.tag).toBe('_UID');
      expect(result.data).toBe('67DB3F217EF0942BE0242809057258A8');
    });

    it('handles level 0 TRLR', () => {
      const result = tokenize('0 TRLR');
      expect(result.tag).toBe('TRLR');
      expect(result.level).toBe(0);
    });
  });

  describe('tokenizeLines', () => {
    it('tokenizes multiple lines', () => {
      const input = `0 HEAD
1 GEDC
2 VERS 5.5.1`;
      const results = tokenizeLines(input);
      expect(results).toHaveLength(3);
      expect(results[0].tag).toBe('HEAD');
      expect(results[1].tag).toBe('GEDC');
      expect(results[2].tag).toBe('VERS');
    });

    it('handles Windows line endings', () => {
      const input = '0 HEAD\r\n1 GEDC\r\n';
      const results = tokenizeLines(input);
      expect(results).toHaveLength(2);
    });

    it('skips empty lines', () => {
      const input = `0 HEAD

1 GEDC`;
      const results = tokenizeLines(input);
      expect(results).toHaveLength(2);
    });
  });
});
