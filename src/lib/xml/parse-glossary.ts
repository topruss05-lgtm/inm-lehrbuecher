import { DOMParser } from '@xmldom/xmldom';
import { readFileSync } from 'fs';
import { renderMath } from './math-renderer.js';
import type { GlossarySymbol } from './docbook-ast.js';

const DB = 'http://docbook.org/ns/docbook';

function getId(el: Element): string {
  return el.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'id') || el.getAttribute('xml:id') || '';
}

function firstChildNS(parent: Element, ns: string, localName: string): Element | null {
  for (let i = 0; i < parent.childNodes.length; i++) {
    const node = parent.childNodes[i];
    if (node.nodeType === 1) {
      const el = node as Element;
      if (el.namespaceURI === ns && el.localName === localName) return el;
    }
  }
  return null;
}

function childElementsNS(parent: Element, ns: string, localName: string): Element[] {
  const result: Element[] = [];
  for (let i = 0; i < parent.childNodes.length; i++) {
    const node = parent.childNodes[i];
    if (node.nodeType === 1) {
      const el = node as Element;
      if (el.namespaceURI === ns && el.localName === localName) result.push(el);
    }
  }
  return result;
}

/** Extract Processing Instruction value: <?inm key="value" ?> → value */
function getPI(parent: Element, piTarget: string, key: string): string {
  for (let i = 0; i < parent.childNodes.length; i++) {
    const node = parent.childNodes[i];
    if (node.nodeType === 7 && node.nodeName === piTarget) {
      const data = node.nodeValue || '';
      const match = data.match(new RegExp(`${key}="([^"]*)"`));
      if (match) return match[1];
    }
  }
  return '';
}

export function parseGlossary(xmlPath: string): GlossarySymbol[] {
  const xml = readFileSync(xmlPath, 'utf-8');
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const result: GlossarySymbol[] = [];

  // Find all <glossdiv> elements (categories)
  const divs = doc.getElementsByTagNameNS(DB, 'glossdiv');

  for (let d = 0; d < divs.length; d++) {
    const div = divs[d] as Element;
    const divId = getId(div);
    const category = divId.replace(/^sym-cat-/, '') || '';

    const entries = childElementsNS(div, DB, 'glossentry');
    for (const entry of entries) {
      const id = getId(entry);

      // Extract LaTeX from glossterm > inlineequation > alt
      const glossterm = firstChildNS(entry, DB, 'glossterm');
      let latex = '';
      if (glossterm) {
        const inlineEq = firstChildNS(glossterm, DB, 'inlineequation');
        if (inlineEq) {
          const alt = firstChildNS(inlineEq, DB, 'alt');
          if (alt) {
            latex = (alt.textContent || '').trim()
              .replace(/^\$\s*/, '').replace(/\s*\$$/, '');
          }
        }
      }

      // Extract description from glossdef > para
      const glossdef = firstChildNS(entry, DB, 'glossdef');
      let fullDescription = '';
      if (glossdef) {
        const para = firstChildNS(glossdef, DB, 'para');
        if (para) fullDescription = (para.textContent || '').trim();
      }

      // Extract see-also references
      const seeAlso: string[] = [];
      if (glossdef) {
        const seeAlsos = childElementsNS(glossdef, DB, 'glossseealso');
        for (const sa of seeAlsos) {
          const otherterm = sa.getAttribute('otherterm') || '';
          if (otherterm) seeAlso.push(otherterm);
        }
      }

      // Extract metadata from processing instructions
      const name = getPI(entry, 'inm', 'name');
      const unit = getPI(entry, 'inm', 'unit');
      const chaptersStr = getPI(entry, 'inm', 'chapters');
      const chapters = chaptersStr ? chaptersStr.split(/\s+/).filter(Boolean) : [];

      // Description: strip "Name — " prefix if present
      const dashIdx = fullDescription.indexOf('—');
      const description = dashIdx >= 0 ? fullDescription.slice(dashIdx + 1).trim() : fullDescription;

      result.push({
        id,
        latex,
        latexHtml: renderMath(`$${latex}$`, false),
        name: name || (dashIdx >= 0 ? fullDescription.slice(0, dashIdx).trim() : ''),
        description,
        unit,
        category,
        seeAlso,
        chapters,
      });
    }
  }

  return result;
}
