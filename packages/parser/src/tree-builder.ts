import type { Token } from './tokenizer.js';

export interface TreeNode {
  level: number;
  tag: string;
  pointer?: string;
  data?: string;
  children: TreeNode[];
}

export function buildTree(tokens: Token[]): TreeNode[] {
  const roots: TreeNode[] = [];
  const stack: TreeNode[] = [];

  for (const token of tokens) {
    // Handle CONT and CONC: merge into parent data, don't create child nodes
    if (token.tag === 'CONT' || token.tag === 'CONC') {
      if (stack.length > 0) {
        const parent = stack[stack.length - 1];
        const fragment = token.data || '';
        if (token.tag === 'CONC') {
          parent.data = (parent.data || '') + fragment;
        } else {
          parent.data = (parent.data || '') + '\n' + fragment;
        }
      }
      continue;
    }

    const node: TreeNode = {
      ...token,
      children: [],
    };

    // Pop stack until we find parent level
    while (stack.length > 0 && stack[stack.length - 1].level >= token.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  return roots;
}

export function findNodes(tree: TreeNode[], predicate: (node: TreeNode) => boolean): TreeNode[] {
  const results: TreeNode[] = [];

  function search(nodes: TreeNode[]) {
    for (const node of nodes) {
      if (predicate(node)) {
        results.push(node);
      }
      search(node.children);
    }
  }

  search(tree);
  return results;
}

export function getFirstChildByTag(node: TreeNode, tag: string): TreeNode | undefined {
  return node.children.find(c => c.tag === tag);
}

export function getDataByTag(node: TreeNode, tag: string): string | undefined {
  const child = getFirstChildByTag(node, tag);
  return child?.data;
}