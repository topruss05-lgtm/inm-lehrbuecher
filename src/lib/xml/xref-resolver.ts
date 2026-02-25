// ═══════════════════════════════════════════════════════════════════
// Cross-Reference Resolver: xml:id → URL + display label
// ═══════════════════════════════════════════════════════════════════

import type { BookNode, ChapterNode, SectionNode, InlineNode } from './docbook-ast.js';

export interface ResolvedXref {
  url: string;
  label: string;
}

/**
 * Build a map from xml:id → { url, label } for all referenceable
 * elements in a course (chapters, sections, equations, definitions, etc.).
 */
export function buildXrefMap(book: BookNode, courseSlug: string): Map<string, ResolvedXref> {
  const map = new Map<string, ResolvedXref>();

  for (const ch of book.chapters) {
    const chapterUrl = `/${courseSlug}/${ch.slug}/`;
    const chapterLabel = ch.isAppendix ? `Anhang ${ch.label}` : `Kapitel ${ch.label}`;

    // Chapter itself
    map.set(ch.id, { url: chapterUrl, label: chapterLabel });

    // Sections
    for (const sec of ch.sections) {
      registerSection(map, sec, chapterUrl);
    }

    // Preamble content
    registerContentIds(map, ch.preamble, chapterUrl);

    // Section content
    for (const sec of ch.sections) {
      registerContentIds(map, sec.children, chapterUrl);
      for (const sub of sec.subsections) {
        registerContentIds(map, sub.children, chapterUrl);
      }
    }
  }

  return map;
}

function inlinesToText(nodes: InlineNode[]): string {
  return nodes.map(n => {
    if (n.type === 'text') return n.content;
    if (n.type === 'inline-math') return n.latex;
    return '';
  }).join('');
}

function registerSection(
  map: Map<string, ResolvedXref>,
  sec: SectionNode,
  chapterUrl: string,
): void {
  if (sec.id) {
    map.set(sec.id, {
      url: `${chapterUrl}#${sec.id}`,
      label: `Abschnitt „${inlinesToText(sec.title)}"`,
    });
  }
  for (const sub of sec.subsections) {
    registerSection(map, sub, chapterUrl);
  }
}

import type { ContentNode } from './docbook-ast.js';

function registerContentIds(
  map: Map<string, ResolvedXref>,
  nodes: ContentNode[],
  chapterUrl: string,
): void {
  for (const node of nodes) {
    if (node.type === 'numbered-equation' && node.id) {
      map.set(node.id, {
        url: `${chapterUrl}#${node.id}`,
        label: node.title || `Gleichung (${node.number})`,
      });
    } else if (node.type === 'formalpara' && node.id) {
      const titleText = inlinesToText(node.title);
      map.set(node.id, {
        url: `${chapterUrl}#${node.id}`,
        label: titleText,
      });
      registerContentIds(map, node.body, chapterUrl);
    } else if (node.type === 'example' && node.id) {
      map.set(node.id, {
        url: `${chapterUrl}#${node.id}`,
        label: node.title || 'Beispiel',
      });
      registerContentIds(map, node.body, chapterUrl);
    } else if (node.type === 'figure' && node.id) {
      map.set(node.id, {
        url: `${chapterUrl}#${node.id}`,
        label: `Abb. ${node.number}`,
      });
    } else if (node.type === 'table' && node.id) {
      map.set(node.id, {
        url: `${chapterUrl}#${node.id}`,
        label: node.title || 'Tabelle',
      });
    } else if (node.type === 'section') {
      registerSection(map, node, chapterUrl);
      registerContentIds(map, node.children, chapterUrl);
      for (const sub of node.subsections) {
        registerContentIds(map, sub.children, chapterUrl);
      }
    }
  }
}
