import type { Token } from './tokenizer';

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
    const node: TreeNode = {
      ...token,
      children: [],
    };

    // Pop stack until we find parent level
    while (stack.length > 0 && stack[stack.length - 1].level >= token.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      // This is a root node
      roots.push(node);
    } else {
      // Add as child of current parent
      stack[stack.length - 1].children.push(node);
    }

    // Push node to stack (may have children)
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
