// ═══════════════════════════════════════════════════════════════════
// DocBook 5 → TypeScript AST Type Definitions
// ═══════════════════════════════════════════════════════════════════

export interface BookNode {
  type: 'book';
  title: string;
  subtitle: string;
  date: string;
  chapters: ChapterNode[];
}

export interface ChapterNode {
  type: 'chapter';
  id: string;
  number: number;
  title: string;
  preamble: ContentNode[];
  sections: SectionNode[];
}

export interface SectionNode {
  type: 'section';
  id: string;
  title: InlineNode[];
  depth: 1 | 2;
  children: ContentNode[];
  subsections: SectionNode[];
}

// ─── Content nodes ──────────────────────────────────────────────

export type ContentNode =
  | ParagraphNode
  | DisplayMathNode
  | NumberedEquationNode
  | FormalParaNode
  | ExampleNode
  | FigureNode
  | TableNode
  | OrderedListNode
  | UnorderedListNode
  | SectionNode;

export interface ParagraphNode {
  type: 'para';
  children: InlineNode[];
}

export interface DisplayMathNode {
  type: 'display-math';
  latex: string;
  html: string;
}

export interface NumberedEquationNode {
  type: 'numbered-equation';
  id: string;
  number: number;
  title: string;
  latex: string;
  html: string;
}

export type FormalParaRole = 'definition' | 'theorem' | 'proof' | 'rule' | 'generic';

export interface FormalParaNode {
  type: 'formalpara';
  id: string;
  role: FormalParaRole;
  title: InlineNode[];
  body: ContentNode[];
}

export interface ExampleNode {
  type: 'example';
  id: string;
  title: string;
  body: ContentNode[];
}

export interface FigureNode {
  type: 'figure';
  id: string;
  number: number;
  title: string;
  altText: string;
}

export interface TableNode {
  type: 'table';
  id: string;
  title: string;
  headers: TableCellNode[][];
  rows: TableCellNode[][];
}

export type TableCellNode = InlineNode;

export interface OrderedListNode {
  type: 'ordered-list';
  items: ContentNode[][];
}

export interface UnorderedListNode {
  type: 'unordered-list';
  items: ContentNode[][];
}

// ─── Inline nodes ───────────────────────────────────────────────

export type InlineNode =
  | TextNode
  | InlineMathNode
  | EmphasisNode;

export interface TextNode {
  type: 'text';
  content: string;
}

export interface InlineMathNode {
  type: 'inline-math';
  latex: string;
  html: string;
}

export type EmphasisRole = 'italic' | 'bold' | 'underline' | 'color-cyan';

export interface EmphasisNode {
  type: 'emphasis';
  role: EmphasisRole;
  children: InlineNode[];
}

// ─── Glossary ───────────────────────────────────────────────────

export interface GlossarySymbol {
  id: string;
  latex: string;
  latexHtml: string;
  name: string;
  description: string;
  unit: string;
  category: string;
  seeAlso: string[];
  chapters: string[];
}
