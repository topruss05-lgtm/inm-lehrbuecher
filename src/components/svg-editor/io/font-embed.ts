let fontBase64Cache: string | null = null;

export async function loadFontBase64(): Promise<string | null> {
  if (fontBase64Cache) return fontBase64Cache;
  try {
    const resp = await fetch('/fonts/lm-math-subset.woff2');
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    fontBase64Cache = btoa(binary);
    return fontBase64Cache;
  } catch {
    return null;
  }
}
