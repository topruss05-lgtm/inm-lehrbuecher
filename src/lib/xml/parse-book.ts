import { DOMParser } from '@xmldom/xmldom';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { renderMath } from './math-renderer.js';
import type {
  BookNode, BookAuthor, ChapterNode, SectionNode, ContentNode, InlineNode,
  ParagraphNode, DisplayMathNode, NumberedEquationNode,
  FormalParaNode, FormalParaRole, ExampleNode, FigureNode,
  TableNode, TableCellNode, OrderedListNode, UnorderedListNode,
  EmphasisNode, EmphasisRole, XrefNode,
} from './docbook-ast.js';

const DB = 'http://docbook.org/ns/docbook';
const XI = 'http://www.w3.org/2001/XInclude';

// ─── Counters ───────────────────────────────────────────────────

let equationCounter = 0;
let figureCounter = 0;

// ─── XInclude Resolution ────────────────────────────────────────

function resolveXIncludes(doc: Document, basePath: string): void {
  const includes = doc.getElementsByTagNameNS(XI, 'include');
  // Process in reverse to maintain positions
  for (let i = includes.length - 1; i >= 0; i--) {
    const inc = includes[i] as Element;
    const href = inc.getAttribute('href');
    if (!href) continue;
    const fullPath = resolve(dirname(basePath), href);
    const content = readFileSync(fullPath, 'utf-8');
    const subDoc = new DOMParser().parseFromString(content, 'text/xml');
    const imported = doc.importNode(subDoc.documentElement, true);
    inc.parentNode?.replaceChild(imported, inc);
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function childElements(parent: Element, localName?: string): Element[] {
  const result: Element[] = [];
  for (let i = 0; i < parent.childNodes.length; i++) {
    const node = parent.childNodes[i];
    if (node.nodeType === 1) {
      const el = node as Element;
      if (!localName || el.localName === localName) {
        result.push(el);
      }
    }
  }
  return result;
}

function childElementsNS(parent: Element, ns: string, localName: string): Element[] {
  const result: Element[] = [];
  for (let i = 0; i < parent.childNodes.length; i++) {
    const node = parent.childNodes[i];
    if (node.nodeType === 1) {
      const el = node as Element;
      if (el.namespaceURI === ns && el.localName === localName) {
        result.push(el);
      }
    }
  }
  return result;
}

function firstChildNS(parent: Element, ns: string, localName: string): Element | null {
  const els = childElementsNS(parent, ns, localName);
  return els.length > 0 ? els[0] : null;
}

function getTextContent(el: Element): string {
  return (el.textContent || '').trim();
}

function getId(el: Element): string {
  return el.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'id') || el.getAttribute('xml:id') || '';
}

function idToSlug(id: string): string {
  // Convert xml:id like "ch.variationsrechnung" to "variationsrechnung"
  return id.replace(/^ch\./, '').replace(/^sec\./, '').replace(/^app\./, '');
}

// ─── Inline Parsing ─────────────────────────────────────────────

function parseInlineNodes(parent: Element): InlineNode[] {
  const result: InlineNode[] = [];

  for (let i = 0; i < parent.childNodes.length; i++) {
    const node = parent.childNodes[i];

    if (node.nodeType === 3) {
      // Text node
      const text = node.textContent || '';
      if (text) {
        result.push({ type: 'text', content: text });
      }
    } else if (node.nodeType === 1) {
      const el = node as Element;
      const ln = el.localName;

      if (ln === 'inlineequation') {
        const alt = firstChildNS(el, DB, 'alt');
        const latex = alt ? getTextContent(alt) : '';
        result.push({
          type: 'inline-math',
          latex,
          html: renderMath(latex, false),
        });
      } else if (ln === 'xref') {
        const linkend = el.getAttribute('linkend') || '';
        result.push({ type: 'xref', linkend } as XrefNode);
      } else if (ln === 'emphasis') {
        const role = el.getAttribute('role') || '';
        let emphRole: EmphasisRole = 'italic';
        if (role === 'bold') emphRole = 'bold';
        else if (role === 'underline') emphRole = 'underline';
        else if (role.startsWith('color-')) emphRole = 'color-cyan';

        result.push({
          type: 'emphasis',
          role: emphRole,
          children: parseInlineNodes(el),
        } as EmphasisNode);
      } else {
        // Unknown inline element - extract text
        const text = el.textContent || '';
        if (text) {
          result.push({ type: 'text', content: text });
        }
      }
    }
  }

  return result;
}

// ─── Content Parsing ────────────────────────────────────────────

function parseContentNodes(parent: Element): ContentNode[] {
  const result: ContentNode[] = [];

  for (let i = 0; i < parent.childNodes.length; i++) {
    const node = parent.childNodes[i];
    if (node.nodeType !== 1) continue;
    const el = node as Element;
    const ln = el.localName;

    if (ln === 'title') continue; // Handled by parent

    if (ln === 'para') {
      result.push(parseParagraph(el));
    } else if (ln === 'informalequation') {
      result.push(parseInformalEquation(el));
    } else if (ln === 'equation') {
      result.push(parseEquation(el));
    } else if (ln === 'formalpara') {
      result.push(parseFormalPara(el));
    } else if (ln === 'example') {
      result.push(parseExample(el));
    } else if (ln === 'figure') {
      result.push(parseFigure(el));
    } else if (ln === 'table') {
      result.push(parseTable(el));
    } else if (ln === 'orderedlist') {
      result.push(parseOrderedList(el));
    } else if (ln === 'itemizedlist') {
      result.push(parseUnorderedList(el));
    } else if (ln === 'section') {
      result.push(parseSection(el, 2));
    }
  }

  return result;
}

function parseParagraph(el: Element): ParagraphNode {
  return {
    type: 'para',
    children: parseInlineNodes(el),
  };
}

function parseInformalEquation(el: Element): DisplayMathNode {
  const alt = firstChildNS(el, DB, 'alt');
  const latex = alt ? getTextContent(alt) : '';
  return {
    type: 'display-math',
    latex,
    html: renderMath(latex, true),
  };
}

function parseEquation(el: Element): NumberedEquationNode {
  equationCounter++;
  const alt = firstChildNS(el, DB, 'alt');
  const latex = alt ? getTextContent(alt) : '';
  const titleEl = firstChildNS(el, DB, 'title');
  return {
    type: 'numbered-equation',
    id: getId(el),
    number: equationCounter,
    title: titleEl ? getTextContent(titleEl) : '',
    latex,
    html: renderMath(latex, true),
  };
}

function parseFormalPara(el: Element): FormalParaNode {
  const role = (el.getAttribute('role') || 'generic') as FormalParaRole;
  const titleEl = firstChildNS(el, DB, 'title');
  const titleNodes: InlineNode[] = titleEl ? parseInlineNodes(titleEl) : [];

  // Body: all <para> children
  const body: ContentNode[] = [];
  const paras = childElementsNS(el, DB, 'para');
  for (const p of paras) {
    body.push(...parseContentNodes(p.parentNode === el ? p.parentNode as Element : el));
  }

  // Actually parse the direct children for body content
  const bodyContent: ContentNode[] = [];
  for (let i = 0; i < el.childNodes.length; i++) {
    const node = el.childNodes[i];
    if (node.nodeType !== 1) continue;
    const child = node as Element;
    if (child.localName === 'title') continue;
    if (child.localName === 'para') {
      bodyContent.push(parseParagraph(child));
    } else if (child.localName === 'informalequation') {
      bodyContent.push(parseInformalEquation(child));
    } else if (child.localName === 'equation') {
      bodyContent.push(parseEquation(child));
    }
  }

  const collapsible = role === 'derivation' || el.getAttribute('collapsible') === 'true';

  return {
    type: 'formalpara',
    id: getId(el),
    role,
    title: titleNodes,
    body: bodyContent,
    ...(collapsible && { collapsible }),
  };
}

function parseExample(el: Element): ExampleNode {
  const titleEl = firstChildNS(el, DB, 'title');
  const title = titleEl ? getTextContent(titleEl) : '';

  const body: ContentNode[] = [];
  for (let i = 0; i < el.childNodes.length; i++) {
    const node = el.childNodes[i];
    if (node.nodeType !== 1) continue;
    const child = node as Element;
    if (child.localName === 'title') continue;
    if (child.localName === 'para') {
      body.push(parseParagraph(child));
    } else if (child.localName === 'informalequation') {
      body.push(parseInformalEquation(child));
    } else if (child.localName === 'equation') {
      body.push(parseEquation(child));
    } else if (child.localName === 'figure') {
      body.push(parseFigure(child));
    } else if (child.localName === 'orderedlist') {
      body.push(parseOrderedList(child));
    } else if (child.localName === 'itemizedlist') {
      body.push(parseUnorderedList(child));
    }
  }

  return {
    type: 'example',
    id: getId(el),
    title,
    body,
  };
}

function parseFigure(el: Element): FigureNode {
  figureCounter++;
  const titleEl = firstChildNS(el, DB, 'title');
  const title = titleEl ? getTextContent(titleEl) : '';

  // Find <phrase> inside <textobject> inside <mediaobject>
  let altText = '';
  const phrases = el.getElementsByTagNameNS(DB, 'phrase');
  if (phrases.length > 0) {
    altText = getTextContent(phrases[0] as Element);
  }

  return {
    type: 'figure',
    id: getId(el),
    number: figureCounter,
    title,
    altText,
  };
}

function parseTable(el: Element): TableNode {
  const titleEl = firstChildNS(el, DB, 'title');
  const title = titleEl ? getTextContent(titleEl) : '';
  const tgroup = firstChildNS(el, DB, 'tgroup');

  const headers: TableCellNode[][] = [];
  const rows: TableCellNode[][] = [];

  if (tgroup) {
    const thead = firstChildNS(tgroup, DB, 'thead');
    const tbody = firstChildNS(tgroup, DB, 'tbody');

    if (thead) {
      for (const row of childElementsNS(thead, DB, 'row')) {
        const cells: TableCellNode[][] = [];
        for (const entry of childElementsNS(row, DB, 'entry')) {
          cells.push(parseInlineNodes(entry));
        }
        headers.push(...cells.map(c => c));
      }
      // Fix: headers should be array of rows, each row is array of cells
      // Redo:
      headers.length = 0;
      for (const row of childElementsNS(thead, DB, 'row')) {
        const rowCells: TableCellNode[] = [];
        for (const entry of childElementsNS(row, DB, 'entry')) {
          // Flatten inline nodes into a single array per cell
          rowCells.push(...parseInlineNodes(entry));
        }
        // Actually each header row should be InlineNode[][]
        // Let me use a simpler model: headers is InlineNode[][] (one row)
      }
    }

    // Simplified: parse as flat arrays
    if (thead) {
      for (const row of childElementsNS(thead, DB, 'row')) {
        const rowData: TableCellNode[][] = [];
        for (const entry of childElementsNS(row, DB, 'entry')) {
          rowData.push(parseInlineNodes(entry));
        }
        headers.push(...rowData);
      }
    }

    if (tbody) {
      for (const row of childElementsNS(tbody, DB, 'row')) {
        const rowData: TableCellNode[][] = [];
        for (const entry of childElementsNS(row, DB, 'entry')) {
          rowData.push(parseInlineNodes(entry));
        }
        rows.push(...rowData);
      }
    }
  }

  return {
    type: 'table',
    id: getId(el),
    title,
    headers,
    rows,
  };
}

function parseOrderedList(el: Element): OrderedListNode {
  const items: ContentNode[][] = [];
  for (const li of childElementsNS(el, DB, 'listitem')) {
    items.push(parseContentNodes(li));
  }
  return { type: 'ordered-list', items };
}

function parseUnorderedList(el: Element): UnorderedListNode {
  const items: ContentNode[][] = [];
  for (const li of childElementsNS(el, DB, 'listitem')) {
    items.push(parseContentNodes(li));
  }
  return { type: 'unordered-list', items };
}

// ─── Section Parsing ────────────────────────────────────────────

function parseSection(el: Element, depth: 1 | 2): SectionNode {
  const titleEl = firstChildNS(el, DB, 'title');
  const titleNodes: InlineNode[] = titleEl ? parseInlineNodes(titleEl) : [];

  const children: ContentNode[] = [];
  const subsections: SectionNode[] = [];

  for (let i = 0; i < el.childNodes.length; i++) {
    const node = el.childNodes[i];
    if (node.nodeType !== 1) continue;
    const child = node as Element;
    const ln = child.localName;

    if (ln === 'title') continue;

    if (ln === 'section') {
      subsections.push(parseSection(child, 2));
    } else if (ln === 'para') {
      children.push(parseParagraph(child));
    } else if (ln === 'informalequation') {
      children.push(parseInformalEquation(child));
    } else if (ln === 'equation') {
      children.push(parseEquation(child));
    } else if (ln === 'formalpara') {
      children.push(parseFormalPara(child));
    } else if (ln === 'example') {
      children.push(parseExample(child));
    } else if (ln === 'figure') {
      children.push(parseFigure(child));
    } else if (ln === 'table') {
      children.push(parseTable(child));
    } else if (ln === 'orderedlist') {
      children.push(parseOrderedList(child));
    } else if (ln === 'itemizedlist') {
      children.push(parseUnorderedList(child));
    }
  }

  return {
    type: 'section',
    id: getId(el),
    title: titleNodes,
    depth,
    children,
    subsections,
  };
}

// ─── Chapter Parsing ────────────────────────────────────────────

function parseChapter(el: Element, number: number): ChapterNode {
  const titleEl = firstChildNS(el, DB, 'title');
  const title = titleEl ? getTextContent(titleEl) : '';

  const preamble: ContentNode[] = [];
  const sections: SectionNode[] = [];

  for (let i = 0; i < el.childNodes.length; i++) {
    const node = el.childNodes[i];
    if (node.nodeType !== 1) continue;
    const child = node as Element;
    const ln = child.localName;

    if (ln === 'title') continue;

    if (ln === 'section') {
      sections.push(parseSection(child, 1));
    } else if (ln === 'para') {
      preamble.push(parseParagraph(child));
    } else if (ln === 'informalequation') {
      preamble.push(parseInformalEquation(child));
    } else if (ln === 'equation') {
      preamble.push(parseEquation(child));
    } else if (ln === 'formalpara') {
      preamble.push(parseFormalPara(child));
    } else if (ln === 'example') {
      preamble.push(parseExample(child));
    }
  }

  const id = getId(el);
  return {
    type: 'chapter',
    id,
    slug: idToSlug(id),
    number,
    label: String(number),
    isAppendix: false,
    title,
    preamble,
    sections,
  };
}

// ─── Book Parsing ───────────────────────────────────────────────

export function parseBook(xmlPath: string): BookNode {
  // Reset counters
  equationCounter = 0;
  figureCounter = 0;

  const xml = readFileSync(xmlPath, 'utf-8');
  const doc = new DOMParser().parseFromString(xml, 'text/xml');

  // Resolve XIncludes
  resolveXIncludes(doc, xmlPath);

  // Parse book metadata
  const bookEl = doc.documentElement;
  const infoEl = firstChildNS(bookEl, DB, 'info');

  let title = '';
  let subtitle = '';
  let date = '';
  let authors: BookAuthor[] = [];
  let copyright: BookNode['copyright'] = null;
  let abstract = '';

  if (infoEl) {
    const titleEl = firstChildNS(infoEl, DB, 'title');
    const subtitleEl = firstChildNS(infoEl, DB, 'subtitle');
    const dateEl = firstChildNS(infoEl, DB, 'date');
    title = titleEl ? getTextContent(titleEl) : '';
    subtitle = subtitleEl ? getTextContent(subtitleEl) : '';
    date = dateEl ? getTextContent(dateEl) : '';

    // Parse authors
    for (const authorEl of childElementsNS(infoEl, DB, 'author')) {
      const pn = firstChildNS(authorEl, DB, 'personname');
      const aff = firstChildNS(authorEl, DB, 'affiliation');
      authors.push({
        firstName: pn ? getTextContent(firstChildNS(pn, DB, 'firstname') as Element || pn) : '',
        surname: pn ? getTextContent(firstChildNS(pn, DB, 'surname') as Element || pn) : '',
        orgName: aff ? getTextContent(firstChildNS(aff, DB, 'orgname') as Element || aff) : '',
        orgDiv: aff ? getTextContent(firstChildNS(aff, DB, 'orgdiv') as Element || aff) : '',
      });
    }

    // Parse copyright
    const crEl = firstChildNS(infoEl, DB, 'copyright');
    if (crEl) {
      const years = childElementsNS(crEl, DB, 'year').map(y => getTextContent(y));
      const holderEl = firstChildNS(crEl, DB, 'holder');
      copyright = { years, holder: holderEl ? getTextContent(holderEl) : '' };
    }

    // Parse abstract
    const absEl = firstChildNS(infoEl, DB, 'abstract');
    if (absEl) {
      const paraEl = firstChildNS(absEl, DB, 'para');
      abstract = paraEl ? getTextContent(paraEl) : getTextContent(absEl);
    }
  }

  // Parse chapters
  const chapterEls = childElementsNS(bookEl, DB, 'chapter');
  const chapters: ChapterNode[] = chapterEls.map((ch, idx) =>
    parseChapter(ch, idx + 1)
  );

  // Parse appendices
  const appendixEls = childElementsNS(bookEl, DB, 'appendix');
  const appendices: ChapterNode[] = appendixEls.map((app, idx) => {
    const node = parseChapter(app, idx + 1);
    node.isAppendix = true;
    node.label = String.fromCharCode(65 + idx); // A, B, C, ...
    // Ensure appendix slug is correct
    if (!node.slug || node.slug === String(idx + 1)) {
      node.slug = idToSlug(node.id);
    }
    return node;
  });

  return { type: 'book', title, subtitle, date, authors, copyright, abstract, chapters: [...chapters, ...appendices] };
}
