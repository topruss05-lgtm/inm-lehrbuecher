/**
 * Post-build script: Runs Pagefind on the dist/ directory and adds
 * custom records for glossary symbols so they appear as top search results.
 */

import * as pagefind from 'pagefind';
import { readdirSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { DOMParser } from '@xmldom/xmldom';

const COURSES_DIR = resolve(process.cwd(), 'content/courses');
const DIST_DIR = resolve(process.cwd(), 'dist');
const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/$/, '');
const DB_NS = 'http://docbook.org/ns/docbook';

// ─── Parse glossary symbols from Standard DocBook XML ────────────

function parseGlossaryForSearch(xmlPath) {
  const xml = readFileSync(xmlPath, 'utf-8');
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const entries = doc.getElementsByTagNameNS(DB_NS, 'glossentry');
  const result = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const id = entry.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'id') || '';

    // Category from parent <glossdiv><title>
    const parent = entry.parentNode;
    let category = '';
    if (parent && parent.localName === 'glossdiv') {
      const titles = parent.getElementsByTagNameNS(DB_NS, 'title');
      if (titles.length > 0) category = (titles[0].textContent || '').trim();
    }

    // LaTeX from <glossterm><inlineequation><alt>$...$</alt>
    let latex = '';
    const terms = entry.getElementsByTagNameNS(DB_NS, 'glossterm');
    if (terms.length > 0) {
      const alts = terms[0].getElementsByTagNameNS(DB_NS, 'alt');
      if (alts.length > 0) {
        latex = (alts[0].textContent || '').trim().replace(/^\$|\$$/g, '');
      }
    }

    // Name from <?inm name="..." ?> processing instruction
    const name = getPI(entry, 'name');
    const unit = getPI(entry, 'unit');

    // Description from <glossdef><para> — strip "Name — " prefix
    let description = '';
    const defs = entry.getElementsByTagNameNS(DB_NS, 'glossdef');
    if (defs.length > 0) {
      const paras = defs[0].getElementsByTagNameNS(DB_NS, 'para');
      if (paras.length > 0) {
        const fullText = (paras[0].textContent || '').trim();
        const dashIdx = fullText.indexOf('—');
        description = dashIdx >= 0 ? fullText.substring(dashIdx + 1).trim() : fullText;
      }
    }

    result.push({ id, category, latex, name, description, unit });
  }

  return result;
}

/** Extract value from <?inm key="value" ?> processing instructions */
function getPI(element, key) {
  for (let node = element.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === 7 && node.nodeName === 'inm') { // PROCESSING_INSTRUCTION_NODE
      const match = node.nodeValue && node.nodeValue.match(new RegExp(`${key}="([^"]*)"`));
      if (match) return match[1];
    }
  }
  return '';
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log('Building Pagefind search index...');

  // Create index from the built HTML
  const { index } = await pagefind.createIndex({});
  if (!index) {
    console.error('Failed to create Pagefind index');
    process.exit(1);
  }

  // Add the built HTML pages
  await index.addDirectory({ path: DIST_DIR });
  console.log('  Indexed HTML pages from dist/');

  // Add glossary symbols as custom records
  const courseEntries = readdirSync(COURSES_DIR, { withFileTypes: true });
  let symbolCount = 0;

  for (const entry of courseEntries) {
    if (!entry.isDirectory()) continue;
    const courseSlug = entry.name;
    const glossaryPath = resolve(COURSES_DIR, courseSlug, 'glossary.xml');

    if (!existsSync(glossaryPath)) continue;

    const symbols = parseGlossaryForSearch(glossaryPath);
    for (const sym of symbols) {
      await index.addCustomRecord({
        url: `${BASE_PATH}/symbolverzeichnis/#${sym.id}`,
        content: `${sym.name}: ${sym.description}. Symbol: ${sym.latex}`,
        language: 'de',
        meta: {
          title: `${sym.name} (${sym.latex})`,
        },
        filters: {
          type: ['Symbol'],
          course: [courseSlug],
        },
        sort: {
          weight: '8',
        },
      });
      symbolCount++;
    }
  }

  console.log(`  Added ${symbolCount} glossary symbol records`);

  // Write the index to dist/pagefind/
  const { errors } = await index.writeFiles({ outputPath: resolve(DIST_DIR, 'pagefind') });
  if (errors.length > 0) {
    console.error('Pagefind errors:', errors);
    process.exit(1);
  }

  console.log('  Search index written to dist/pagefind/');
  console.log('Done!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
