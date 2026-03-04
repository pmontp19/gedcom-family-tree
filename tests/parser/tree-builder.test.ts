import { describe, it, expect } from 'vitest';
import { buildTree, type TreeNode } from '@/parser/tree-builder';
import { tokenizeLines } from '@/parser/tokenizer';

describe('tree-builder', () => {
  describe('buildTree', () => {
    it('builds simple hierarchy', () => {
      const tokens = tokenizeLines(`0 HEAD
1 GEDC
2 VERS 5.5.1`);
      const tree = buildTree(tokens);

      expect(tree).toHaveLength(1);
      expect(tree[0].tag).toBe('HEAD');
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].tag).toBe('GEDC');
      expect(tree[0].children[0].children).toHaveLength(1);
      expect(tree[0].children[0].children[0].tag).toBe('VERS');
    });

    it('handles multiple root records', () => {
      const tokens = tokenizeLines(`0 HEAD
0 @I1@ INDI
1 NAME John
0 @I2@ INDI
1 NAME Jane`);
      const tree = buildTree(tokens);

      expect(tree).toHaveLength(3);
      expect(tree[0].tag).toBe('HEAD');
      expect(tree[1].tag).toBe('INDI');
      expect(tree[1].pointer).toBe('I1');
      expect(tree[2].tag).toBe('INDI');
      expect(tree[2].pointer).toBe('I2');
    });

    it('builds individual record correctly', () => {
      const tokens = tokenizeLines(`0 @I1@ INDI
1 NAME Ramon /Ossó, Sendrós/
2 GIVN Ramon
2 SURN Ossó, Sendrós
1 SEX M
1 BIRT
2 DATE 7 JAN 1964
1 FAMC @F7@`);
      const tree = buildTree(tokens);

      expect(tree).toHaveLength(1);
      const indi = tree[0];
      expect(indi.pointer).toBe('I1');
      expect(indi.children).toHaveLength(4);

      const nameNode = indi.children.find(c => c.tag === 'NAME');
      expect(nameNode?.data).toBe('Ramon /Ossó, Sendrós/');
      expect(nameNode?.children).toHaveLength(2);

      const birthNode = indi.children.find(c => c.tag === 'BIRT');
      expect(birthNode?.children).toHaveLength(1);
      expect(birthNode?.children[0].tag).toBe('DATE');
    });

    it('handles family record', () => {
      const tokens = tokenizeLines(`0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
1 MARR
2 DATE 1990`);
      const tree = buildTree(tokens);

      expect(tree).toHaveLength(1);
      const fam = tree[0];
      expect(fam.pointer).toBe('F1');
      expect(fam.children).toHaveLength(4);
    });
  });
});
