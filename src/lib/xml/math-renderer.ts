import katex from 'katex';

/**
 * Strip LaTeX delimiters: \[ \], $ $
 */
function stripDelimiters(latex: string): string {
  return latex
    .replace(/^\s*\\\[\s*/, '')
    .replace(/\s*\\\]\s*$/, '')
    .replace(/^\s*\$\s*/, '')
    .replace(/\s*\$\s*$/, '')
    .trim();
}

/**
 * Render a LaTeX string to HTML using KaTeX (build-time).
 */
export function renderMath(raw: string, displayMode: boolean): string {
  const latex = stripDelimiters(raw);
  if (!latex) return '';
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      output: 'html',
    });
  } catch {
    return `<span class="math-error">${escapeHtml(latex)}</span>`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
