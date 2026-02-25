/**
 * DocBook AST → LaTeX → PDF build script.
 *
 * Uses the same parseBook()/parseGlossary() pipeline as the Astro site,
 * converts the AST to LaTeX, then compiles via latexmk.
 *
 * Usage:
 *   node scripts/build-pdf.mjs [course-slug]
 *   node scripts/build-pdf.mjs dynamik
 */

import { readdirSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { execFileSync } from 'child_process';

// ─── Inline import of the TS modules via Astro's built pipeline ──
// We re-parse XML directly here to avoid needing tsx/ts-node at runtime.
import { DOMParser } from '@xmldom/xmldom';

const COURSES_DIR = resolve(process.cwd(), 'content/courses');
const BUILD_DIR = resolve(process.cwd(), 'build');
const DB = 'http://docbook.org/ns/docbook';
const XI = 'http://www.w3.org/2001/XInclude';

// ═══════════════════════════════════════════════════════════════════
// Minimal XML helpers (mirrors parse-book.ts logic)
// ═══════════════════════════════════════════════════════════════════

function childElementsNS(parent, ns, localName) {
  const result = [];
  for (let i = 0; i < parent.childNodes.length; i++) {
    const node = parent.childNodes[i];
    if (node.nodeType === 1 && node.namespaceURI === ns && node.localName === localName) {
      result.push(node);
    }
  }
  return result;
}

function firstChildNS(parent, ns, localName) {
  const els = childElementsNS(parent, ns, localName);
  return els.length > 0 ? els[0] : null;
}

function getText(el) {
  return el ? (el.textContent || '').trim() : '';
}

function getId(el) {
  return el.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'id') || el.getAttribute('xml:id') || '';
}

function resolveXIncludes(doc, basePath) {
  const includes = doc.getElementsByTagNameNS(XI, 'include');
  for (let i = includes.length - 1; i >= 0; i--) {
    const inc = includes[i];
    const href = inc.getAttribute('href');
    if (!href) continue;
    const fullPath = resolve(dirname(basePath), href);
    const content = readFileSync(fullPath, 'utf-8');
    const subDoc = new DOMParser().parseFromString(content, 'text/xml');
    const imported = doc.importNode(subDoc.documentElement, true);
    inc.parentNode.replaceChild(imported, inc);
  }
}

// ═══════════════════════════════════════════════════════════════════
// LaTeX Escaping
// ═══════════════════════════════════════════════════════════════════

function escLatex(text) {
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/[&%$#_{}]/g, (c) => '\\' + c)
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/\u2014/g, '---')  // em dash
    .replace(/\u2013/g, '--')   // en dash
    .replace(/\u201e/g, '\\glqq{}')  // „
    .replace(/\u201c/g, '\\grqq{}')  // "
    .replace(/\u201a/g, '\\glq{}')   // ‚
    .replace(/\u2018/g, '\\grq{}')  // '
    // Greek letters
    .replace(/\u03A6/g, '$\\Phi$')
    .replace(/\u03B1/g, '$\\alpha$')
    .replace(/\u03B2/g, '$\\beta$')
    .replace(/\u03B3/g, '$\\gamma$')
    .replace(/\u03B4/g, '$\\delta$')
    .replace(/\u03C9/g, '$\\omega$')
    .replace(/\u03BB/g, '$\\lambda$')
    .replace(/\u03BC/g, '$\\mu$')
    .replace(/\u03C0/g, '$\\pi$')
    .replace(/\u03C3/g, '$\\sigma$')
    .replace(/\u03C4/g, '$\\tau$')
    .replace(/\u03C6/g, '$\\varphi$')
    // Math symbols
    .replace(/\u00B7/g, '$\\cdot$')       // ·
    .replace(/\u00BD/g, '$\\frac{1}{2}$') // ½
    .replace(/\u2265/g, '$\\geq$')        // ≥
    .replace(/\u2264/g, '$\\leq$')        // ≤
    .replace(/\u2260/g, '$\\neq$')        // ≠
    .replace(/\u00B2/g, '$^2$');          // ²
}

// ═══════════════════════════════════════════════════════════════════
// Inline → LaTeX
// ═══════════════════════════════════════════════════════════════════

function inlineToLatex(el) {
  let result = '';
  for (let i = 0; i < el.childNodes.length; i++) {
    const node = el.childNodes[i];
    if (node.nodeType === 3) {
      result += escLatex(node.textContent || '');
    } else if (node.nodeType === 1) {
      const ln = node.localName;
      if (ln === 'inlineequation') {
        const alt = firstChildNS(node, DB, 'alt');
        result += getText(alt); // Already contains $...$
      } else if (ln === 'emphasis') {
        const role = node.getAttribute('role') || '';
        const inner = inlineToLatex(node);
        if (role === 'bold') result += `\\textbf{${inner}}`;
        else if (role === 'underline') result += `\\underline{${inner}}`;
        else if (role.startsWith('color-')) result += `\\textcolor{cyan}{${inner}}`;
        else result += `\\emph{${inner}}`;
      } else if (ln === 'xref') {
        const linkend = node.getAttribute('linkend') || '';
        result += `\\hyperref[${linkend}]{\\autoref*{${linkend}}}`;
      } else {
        result += escLatex(node.textContent || '');
      }
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════
// Block content → LaTeX
// ═══════════════════════════════════════════════════════════════════

function contentToLatex(el) {
  let result = '';
  for (let i = 0; i < el.childNodes.length; i++) {
    const node = el.childNodes[i];
    if (node.nodeType !== 1) continue;
    const ln = node.localName;

    if (ln === 'title') continue;

    if (ln === 'para') {
      result += '\n' + inlineToLatex(node) + '\n';
    } else if (ln === 'informalequation') {
      const alt = firstChildNS(node, DB, 'alt');
      result += '\n' + getText(alt) + '\n';
    } else if (ln === 'equation') {
      const alt = firstChildNS(node, DB, 'alt');
      const id = getId(node);
      const titleEl = firstChildNS(node, DB, 'title');
      const title = getText(titleEl);
      const latex = getText(alt);

      // Strip \[ and \] delimiters for equation environment
      const stripped = latex.replace(/^\\\[/, '').replace(/\\\]$/, '').trim();
      result += `\n\\begin{equation}`;
      if (id) result += `\\label{${id}}`;
      result += `\n${stripped}\n\\end{equation}\n`;
      if (title) result += `% ${title}\n`;
    } else if (ln === 'formalpara') {
      result += formalparaToLatex(node);
    } else if (ln === 'example') {
      result += exampleToLatex(node);
    } else if (ln === 'figure') {
      result += figureToLatex(node);
    } else if (ln === 'table') {
      result += tableToLatex(node);
    } else if (ln === 'orderedlist') {
      result += listToLatex(node, 'enumerate');
    } else if (ln === 'itemizedlist') {
      result += listToLatex(node, 'itemize');
    } else if (ln === 'section') {
      result += sectionToLatex(node, 2);
    }
  }
  return result;
}

function formalparaToLatex(el) {
  const role = el.getAttribute('role') || 'generic';
  const id = getId(el);
  const titleEl = firstChildNS(el, DB, 'title');
  const title = titleEl ? inlineToLatex(titleEl) : '';

  let envName = 'genericbox';
  if (role === 'definition') envName = 'definition';
  else if (role === 'theorem') envName = 'theorem';
  else if (role === 'proof') envName = 'proof';
  else if (role === 'rule') envName = 'rulebox';

  let result = `\n\\begin{${envName}}`;
  if (title && envName !== 'proof') result += `[title={${title}}]`;
  result += '\n';
  if (id) result += `\\label{${id}}\n`;

  // Body content (children except title)
  for (let i = 0; i < el.childNodes.length; i++) {
    const node = el.childNodes[i];
    if (node.nodeType !== 1) continue;
    if (node.localName === 'title') continue;
    if (node.localName === 'para') {
      result += inlineToLatex(node) + '\n';
    } else if (node.localName === 'informalequation') {
      const alt = firstChildNS(node, DB, 'alt');
      result += getText(alt) + '\n';
    } else if (node.localName === 'equation') {
      const alt = firstChildNS(node, DB, 'alt');
      const eqId = getId(node);
      const stripped = getText(alt).replace(/^\\\[/, '').replace(/\\\]$/, '').trim();
      result += `\\begin{equation}`;
      if (eqId) result += `\\label{${eqId}}`;
      result += `\n${stripped}\n\\end{equation}\n`;
    }
  }
  result += `\\end{${envName}}\n`;
  return result;
}

function exampleToLatex(el) {
  const titleEl = firstChildNS(el, DB, 'title');
  const title = getText(titleEl);
  const id = getId(el);
  let result = `\n\\begin{example}[title={${escLatex(title)}}]\n`;
  if (id) result += `\\label{${id}}\n`;
  result += contentToLatex(el);
  result += `\\end{example}\n`;
  return result;
}

function figureToLatex(el) {
  const titleEl = firstChildNS(el, DB, 'title');
  const title = getText(titleEl);
  const id = getId(el);
  const phrases = el.getElementsByTagNameNS(DB, 'phrase');
  const altText = phrases.length > 0 ? getText(phrases[0]) : '';

  // Use non-floating center+captionof to avoid issues inside tcolorbox
  let result = `\n\\begin{center}\n`;
  result += `% TODO: Include actual figure file\n`;
  result += `\\fbox{\\parbox{0.8\\textwidth}{\\centering\\small ${escLatex(altText || 'Abbildung')}}}\n`;
  if (title) result += `\\captionof{figure}{${escLatex(title)}}\n`;
  if (id) result += `\\label{${id}}\n`;
  result += `\\end{center}\n`;
  return result;
}

function tableToLatex(el) {
  const titleEl = firstChildNS(el, DB, 'title');
  const title = getText(titleEl);
  const id = getId(el);
  const tgroup = firstChildNS(el, DB, 'tgroup');
  if (!tgroup) return '';

  const cols = parseInt(tgroup.getAttribute('cols') || '3', 10);
  const colSpec = Array(cols).fill('l').join(' ');

  let result = `\n\\begin{table}[htbp]\n\\centering\n`;
  if (title) result += `\\caption{${escLatex(title)}}\n`;
  if (id) result += `\\label{${id}}\n`;
  result += `\\begin{tabular}{${colSpec}}\n\\toprule\n`;

  const thead = firstChildNS(tgroup, DB, 'thead');
  if (thead) {
    for (const row of childElementsNS(thead, DB, 'row')) {
      const cells = childElementsNS(row, DB, 'entry').map(e => inlineToLatex(e));
      result += cells.join(' & ') + ' \\\\\n\\midrule\n';
    }
  }

  const tbody = firstChildNS(tgroup, DB, 'tbody');
  if (tbody) {
    for (const row of childElementsNS(tbody, DB, 'row')) {
      const cells = childElementsNS(row, DB, 'entry').map(e => inlineToLatex(e));
      result += cells.join(' & ') + ' \\\\\n';
    }
  }

  result += `\\bottomrule\n\\end{tabular}\n\\end{table}\n`;
  return result;
}

function listToLatex(el, env) {
  let result = `\n\\begin{${env}}\n`;
  for (const li of childElementsNS(el, DB, 'listitem')) {
    result += `\\item `;
    result += contentToLatex(li).trim();
    result += '\n';
  }
  result += `\\end{${env}}\n`;
  return result;
}

function sectionToLatex(el, depth) {
  const titleEl = firstChildNS(el, DB, 'title');
  const title = titleEl ? inlineToLatex(titleEl) : '';
  const id = getId(el);
  const cmd = depth === 1 ? 'section' : 'subsection';
  let result = `\n\\${cmd}{${title}}`;
  if (id) result += `\\label{${id}}`;
  result += '\n';
  result += contentToLatex(el);
  return result;
}

// ═══════════════════════════════════════════════════════════════════
// Glossary → LaTeX
// ═══════════════════════════════════════════════════════════════════

function glossaryToLatex(glossaryPath) {
  if (!existsSync(glossaryPath)) return '';
  const xml = readFileSync(glossaryPath, 'utf-8');
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const divs = doc.getElementsByTagNameNS(DB, 'glossdiv');

  let result = '\n\\chapter*{Symbolverzeichnis}\n\\addcontentsline{toc}{chapter}{Symbolverzeichnis}\n\n';

  for (let d = 0; d < divs.length; d++) {
    const div = divs[d];
    const divTitle = firstChildNS(div, DB, 'title');
    result += `\\subsection*{${getText(divTitle)}}\n\n`;
    result += '\\begin{longtable}{@{}p{2cm}p{4cm}p{7cm}p{1.5cm}@{}}\n';
    result += '\\toprule\n\\textbf{Symbol} & \\textbf{Name} & \\textbf{Beschreibung} & \\textbf{Einheit} \\\\\n\\midrule\n\\endhead\n';

    const entries = childElementsNS(div, DB, 'glossentry');
    for (const entry of entries) {
      // LaTeX symbol
      const term = firstChildNS(entry, DB, 'glossterm');
      const alt = term ? firstChildNS(term, DB, 'inlineequation') : null;
      const altEl = alt ? firstChildNS(alt, DB, 'alt') : null;
      const latex = getText(altEl);

      // Name and description from PI and glossdef
      let name = '';
      let unit = '';
      for (let node = entry.firstChild; node; node = node.nextSibling) {
        if (node.nodeType === 7 && node.nodeName === 'inm') {
          const nameMatch = node.nodeValue && node.nodeValue.match(/name="([^"]*)"/);
          if (nameMatch) name = nameMatch[1];
          const unitMatch = node.nodeValue && node.nodeValue.match(/unit="([^"]*)"/);
          if (unitMatch) unit = unitMatch[1];
        }
      }

      const def = firstChildNS(entry, DB, 'glossdef');
      let desc = '';
      if (def) {
        const para = firstChildNS(def, DB, 'para');
        if (para) {
          const fullText = getText(para);
          const dashIdx = fullText.indexOf('\u2014');
          desc = dashIdx >= 0 ? fullText.substring(dashIdx + 1).trim() : fullText;
        }
      }

      result += `${latex} & ${escLatex(name)} & ${escLatex(desc)} & ${escLatex(unit)} \\\\\n`;
    }

    result += '\\bottomrule\n\\end{longtable}\n\n';
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// Full book → LaTeX document
// ═══════════════════════════════════════════════════════════════════

function buildLatex(courseSlug) {
  const courseDir = resolve(COURSES_DIR, courseSlug);
  const bookPath = resolve(courseDir, 'book.xml');
  const glossaryPath = resolve(courseDir, 'glossary.xml');

  if (!existsSync(bookPath)) {
    console.error(`No book.xml found in ${courseDir}`);
    process.exit(1);
  }

  const xml = readFileSync(bookPath, 'utf-8');
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  resolveXIncludes(doc, bookPath);

  const bookEl = doc.documentElement;
  const infoEl = firstChildNS(bookEl, DB, 'info');

  // Metadata
  const title = getText(firstChildNS(infoEl, DB, 'title'));
  const subtitle = getText(firstChildNS(infoEl, DB, 'subtitle'));

  let author = '';
  const authorEl = firstChildNS(infoEl, DB, 'author');
  if (authorEl) {
    const pn = firstChildNS(authorEl, DB, 'personname');
    const fn = pn ? getText(firstChildNS(pn, DB, 'firstname')) : '';
    const sn = pn ? getText(firstChildNS(pn, DB, 'surname')) : '';
    author = `${fn} ${sn}`.trim();
    const aff = firstChildNS(authorEl, DB, 'affiliation');
    if (aff) {
      const orgName = getText(firstChildNS(aff, DB, 'orgname'));
      const orgDiv = getText(firstChildNS(aff, DB, 'orgdiv'));
      if (orgName) author += `\\\\\\small ${escLatex(orgName)}`;
      if (orgDiv) author += `, ${escLatex(orgDiv)}`;
    }
  }

  let abstractText = '';
  const absEl = firstChildNS(infoEl, DB, 'abstract');
  if (absEl) {
    const paraEl = firstChildNS(absEl, DB, 'para');
    abstractText = getText(paraEl);
  }

  // ─── LaTeX preamble ────────────────────────────────────────────
  let latex = `% Auto-generated from DocBook XML — do not edit manually
\\documentclass[a4paper, 11pt, twoside, openright]{book}

% ─── Encoding & Language (LuaLaTeX) ─────────────────────────────
\\usepackage{fontspec}
\\usepackage[ngerman]{babel}

% ─── Fonts ───────────────────────────────────────────────────────
\\setmainfont{Latin Modern Roman}
\\setsansfont{Latin Modern Sans}
\\setmonofont{Latin Modern Mono}

% ─── Math ────────────────────────────────────────────────────────
\\usepackage{amsmath, amssymb, amsfonts}
\\usepackage{bm}
\\usepackage{mathtools}

% ─── Layout ──────────────────────────────────────────────────────
\\usepackage[margin=2.5cm, inner=3cm, outer=2cm]{geometry}
\\usepackage{fancyhdr}
\\pagestyle{fancy}
\\fancyhf{}
\\fancyhead[LE]{\\leftmark}
\\fancyhead[RO]{\\rightmark}
\\fancyfoot[C]{\\thepage}
\\renewcommand{\\headrulewidth}{0.4pt}

% ─── Tables ──────────────────────────────────────────────────────
\\usepackage{booktabs}
\\usepackage{longtable}

% ─── Graphics ────────────────────────────────────────────────────
\\usepackage{graphicx}
\\usepackage{caption}
\\usepackage{xcolor}

% ─── Boxes (Definitions, Theorems, etc.) ─────────────────────────
\\usepackage[most]{tcolorbox}

\\newtcolorbox{definition}[1][]{%
  enhanced, breakable,
  colback=blue!3, colframe=blue!50!black,
  fonttitle=\\bfseries,
  #1
}

\\newtcolorbox{theorem}[1][]{%
  enhanced, breakable,
  colback=green!3, colframe=green!40!black,
  fonttitle=\\bfseries,
  #1
}

\\newtcolorbox{proof}[1][]{%
  enhanced, breakable,
  colback=gray!3, colframe=gray!50,
  fonttitle=\\itshape,
  title=Beweis,
  #1
}

\\newtcolorbox{rulebox}[1][]{%
  enhanced, breakable,
  colback=orange!3, colframe=orange!60!black,
  fonttitle=\\bfseries,
  #1
}

\\newtcolorbox{genericbox}[1][]{%
  enhanced, breakable,
  colback=gray!5, colframe=gray!40,
  fonttitle=\\bfseries,
  #1
}

\\newtcolorbox{example}[1][]{%
  enhanced, breakable,
  colback=yellow!3, colframe=yellow!60!black,
  fonttitle=\\bfseries,
  #1
}

% ─── Hyperlinks ──────────────────────────────────────────────────
\\usepackage{hyperref}
\\hypersetup{
  colorlinks=true,
  linkcolor=blue!60!black,
  urlcolor=blue!50!black,
  citecolor=green!50!black,
  pdfborder={0 0 0},
}
\\usepackage{bookmark}

% ─── Cross-reference names ───────────────────────────────────────
\\usepackage[ngerman]{cleveref}

% ═════════════════════════════════════════════════════════════════

\\title{${escLatex(title)}${subtitle ? '\\\\[0.5em]\\large ' + escLatex(subtitle) : ''}}
\\author{${author || 'Institut f\\\"ur Nichtlineare Mechanik'}}
\\date{}

\\begin{document}

\\maketitle
`;

  if (abstractText) {
    latex += `\n\\noindent\\textit{${escLatex(abstractText)}}\n\\bigskip\n`;
  }

  latex += `\n\\tableofcontents\n\\newpage\n`;

  // ─── Chapters ──────────────────────────────────────────────────
  const chapterEls = childElementsNS(bookEl, DB, 'chapter');
  for (const chEl of chapterEls) {
    const chTitle = firstChildNS(chEl, DB, 'title');
    const chId = getId(chEl);
    latex += `\n\\chapter{${getText(chTitle)}}`;
    if (chId) latex += `\\label{${chId}}`;
    latex += '\n';
    latex += contentToLatex(chEl);

    // Sections
    for (const secEl of childElementsNS(chEl, DB, 'section')) {
      latex += sectionToLatex(secEl, 1);
    }
  }

  // ─── Appendices ────────────────────────────────────────────────
  const appendixEls = childElementsNS(bookEl, DB, 'appendix');
  if (appendixEls.length > 0) {
    latex += '\n\\appendix\n';
    for (const appEl of appendixEls) {
      const appTitle = firstChildNS(appEl, DB, 'title');
      const appId = getId(appEl);
      latex += `\n\\chapter{${getText(appTitle)}}`;
      if (appId) latex += `\\label{${appId}}`;
      latex += '\n';
      latex += contentToLatex(appEl);

      for (const secEl of childElementsNS(appEl, DB, 'section')) {
        latex += sectionToLatex(secEl, 1);
      }
    }
  }

  // ─── Glossary ──────────────────────────────────────────────────
  latex += glossaryToLatex(glossaryPath);

  latex += '\n\\end{document}\n';
  return latex;
}

// ═══════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════

function main() {
  const slug = process.argv[2];
  if (!slug) {
    // Build all courses
    const entries = readdirSync(COURSES_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!existsSync(resolve(COURSES_DIR, entry.name, 'book.xml'))) continue;
      buildCourse(entry.name);
    }
  } else {
    buildCourse(slug);
  }
}

function buildCourse(slug) {
  console.log(`\nBuilding PDF for course: ${slug}`);

  // Generate LaTeX
  const latex = buildLatex(slug);
  const outDir = resolve(BUILD_DIR, slug);
  mkdirSync(outDir, { recursive: true });

  const texPath = resolve(outDir, `${slug}.tex`);
  writeFileSync(texPath, latex, 'utf-8');
  console.log(`  LaTeX written to ${texPath}`);

  // Compile with latexmk (no user input in the command — slug is validated
  // against filesystem entries from COURSES_DIR)
  try {
    console.log('  Running latexmk...');
    execFileSync('latexmk', ['-lualatex', '-interaction=nonstopmode', '-halt-on-error', `${slug}.tex`], {
      cwd: outDir,
      stdio: 'pipe',
      timeout: 120000,
    });
    console.log(`  PDF generated: ${resolve(outDir, slug + '.pdf')}`);
  } catch (err) {
    // Show tail of log for debugging
    const logPath = resolve(outDir, `${slug}.log`);
    if (existsSync(logPath)) {
      const log = readFileSync(logPath, 'utf-8');
      const lines = log.split('\n');
      const errorLines = lines.filter(l => l.startsWith('!') || l.includes('Error'));
      console.error('  LaTeX errors:');
      errorLines.slice(0, 20).forEach(l => console.error('    ' + l));
    }
    console.error(`  latexmk failed. Check ${outDir}/${slug}.log for details.`);
    process.exit(1);
  }
}

main();
