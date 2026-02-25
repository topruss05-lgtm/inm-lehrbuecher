import { readdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parseBook } from './parse-book.js';
import { parseGlossary } from './parse-glossary.js';
import { buildXrefMap, type ResolvedXref } from './xref-resolver.js';
import type { BookNode, GlossarySymbol } from './docbook-ast.js';

export interface CourseInfo {
  slug: string;
  contentDir: string;
  book: BookNode;
  glossary: GlossarySymbol[];
  xrefMap: Map<string, ResolvedXref>;
}

const COURSES_DIR = resolve(process.cwd(), 'content/courses');
const base = (import.meta.env?.BASE_URL ?? process.env.BASE_PATH ?? '').replace(/\/$/, '');

export function discoverCourses(): CourseInfo[] {
  if (!existsSync(COURSES_DIR)) return [];

  const entries = readdirSync(COURSES_DIR, { withFileTypes: true });
  const courses: CourseInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const courseDir = resolve(COURSES_DIR, entry.name);
    const bookPath = resolve(courseDir, 'book.xml');
    const glossaryPath = resolve(courseDir, 'glossary.xml');

    if (!existsSync(bookPath)) continue;

    const book = parseBook(bookPath);
    const glossary = existsSync(glossaryPath) ? parseGlossary(glossaryPath) : [];
    const xrefMap = buildXrefMap(book, entry.name, base);

    courses.push({
      slug: entry.name,
      contentDir: courseDir,
      book,
      glossary,
      xrefMap,
    });
  }

  return courses.sort((a, b) => a.book.title.localeCompare(b.book.title));
}

export function getCourse(slug: string): CourseInfo | undefined {
  const courseDir = resolve(COURSES_DIR, slug);
  const bookPath = resolve(courseDir, 'book.xml');
  const glossaryPath = resolve(courseDir, 'glossary.xml');

  if (!existsSync(bookPath)) return undefined;

  const book = parseBook(bookPath);
  const glossary = existsSync(glossaryPath) ? parseGlossary(glossaryPath) : [];
  const xrefMap = buildXrefMap(book, slug, base);

  return { slug, contentDir: courseDir, book, glossary, xrefMap };
}
