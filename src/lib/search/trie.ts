/**
 * @file trie.ts
 * @description Prefix tree (trie) powering instant autocomplete. Each terminal
 * node carries the set of document IDs whose text contains that term, plus a
 * document-frequency count used to rank completions by popularity. This is the
 * structure that replaces fuse.js in the suggestion path.
 *
 *   insert("taco", "biz-1"); insert("tacos"->"taco", "biz-2"); insert("tea", "biz-3")
 *
 *            (root)
 *            /    \
 *           t      ...
 *           |
 *        +--+--+
 *        a     e
 *        |     |
 *        c     a*("tea" terms collapse via tokenizer; illustrative)
 *        |
 *        o*  <- terminal: docIds {biz-1, biz-2}, df=2
 */

interface TrieNode {
  children: Map<string, TrieNode>;
  /** Doc IDs for the term ending at this node (terminal nodes only). */
  docIds: Set<string> | null;
}

const createNode = (): TrieNode => ({ children: new Map(), docIds: null });

export interface TrieCompletion {
  term: string;
  docIds: Set<string>;
}

export class Trie {
  private readonly root: TrieNode = createNode();

  /** Insert a term and associate it with a document ID. Idempotent per (term,id). */
  insert(term: string, docId: string): void {
    if (!term) return;
    let node = this.root;
    for (const ch of term) {
      let next = node.children.get(ch);
      if (!next) {
        next = createNode();
        node.children.set(ch, next);
      }
      node = next;
    }
    if (!node.docIds) node.docIds = new Set();
    node.docIds.add(docId);
  }

  /** Does an exact term exist in the trie? */
  has(term: string): boolean {
    const node = this.nodeAt(term);
    return node?.docIds != null && node.docIds.size > 0;
  }

  /**
   * Collect every completion under `prefix`, depth-first. Each completion
   * carries the doc IDs at that term. Caller ranks; we just enumerate.
   */
  completions(prefix: string): TrieCompletion[] {
    const start = this.nodeAt(prefix);
    if (!start) return [];
    const out: TrieCompletion[] = [];
    const stack: Array<{ node: TrieNode; term: string }> = [{ node: start, term: prefix }];
    while (stack.length > 0) {
      const { node, term } = stack.pop()!;
      if (node.docIds && node.docIds.size > 0) {
        out.push({ term, docIds: node.docIds });
      }
      for (const [ch, child] of node.children) {
        stack.push({ node: child, term: term + ch });
      }
    }
    return out;
  }

  private nodeAt(prefix: string): TrieNode | null {
    let node = this.root;
    for (const ch of prefix) {
      const next = node.children.get(ch);
      if (!next) return null;
      node = next;
    }
    return node;
  }
}
