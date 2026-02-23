import { DOMParser } from '@xmldom/xmldom';
import { readFileSync } from 'fs';
import { renderMath } from './math-renderer.js';
import type { GlossarySymbol } from './docbook-ast.js';

const SYM_NS = 'urn:dynamik:symbols';

function getChildText(parent: Element, localName: string): string {
  const els = parent.getElementsByTagNameNS(SYM_NS, localName);
  if (els.length === 0) return '';
  return (els[0].textContent || '').trim();
}

export function parseGlossary(xmlPath: string): GlossarySymbol[] {
  const xml = readFileSync(xmlPath, 'utf-8');
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const symbols = doc.getElementsByTagNameNS(SYM_NS, 'symbol');
  const result: GlossarySymbol[] = [];

  for (let i = 0; i < symbols.length; i++) {
    const sym = symbols[i] as Element;
    const id = sym.getAttribute('id') || '';
    const category = sym.getAttribute('category') || '';
    const latex = getChildText(sym, 'latex');
    const name = getChildText(sym, 'name');
    const description = getChildText(sym, 'description');
    const unit = getChildText(sym, 'unit');

    const seeAlsoText = getChildText(sym, 'see-also');
    const seeAlso = seeAlsoText ? seeAlsoText.split(/\s+/).filter(Boolean) : [];

    // context element with chapters attribute
    let chapters: string[] = [];
    const ctxEls = sym.getElementsByTagNameNS(SYM_NS, 'context');
    if (ctxEls.length > 0) {
      const chapAttr = (ctxEls[0] as Element).getAttribute('chapters') || '';
      chapters = chapAttr.split(/\s+/).filter(Boolean);
    }

    result.push({
      id,
      latex,
      latexHtml: renderMath(`$${latex}$`, false),
      name,
      description,
      unit,
      category,
      seeAlso,
      chapters,
    });
  }

  return result;
}
