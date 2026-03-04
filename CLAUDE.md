# INM Lehrbücher — Astro-Plattform

Universitäre Vorlesungsskripte als statische Website und Druckversion (Single Source of Truth). DocBook-5-XML → TypeScript-AST → Astro-Komponenten → statisches HTML mit KaTeX-Matheformeln. Dasselbe XML dient als Grundlage für den PDF-Export (Lehrbuch-Qualität).

## Commands

```bash
npm run dev          # Astro Dev-Server (localhost:4321)
npm run build        # Astro Build + Pagefind Search-Index
npm run build:astro  # Nur Astro Build (ohne Search-Index)
npm run preview      # Built-Site lokal ansehen
npm run build:pdf    # PDF-Export (scripts/build-pdf.mjs)
```

## Architektur

### Content-Pipeline

```
content/courses/<slug>/book.xml     ← DocBook 5 XML (XInclude für Kapitel)
content/courses/<slug>/glossary.xml ← Symbolverzeichnis (glossdiv/glossentry)
        ↓
src/lib/xml/parse-book.ts           ← XML → BookNode AST (mit XInclude-Auflösung)
src/lib/xml/parse-glossary.ts       ← XML → GlossarySymbol[]
src/lib/xml/math-renderer.ts        ← LaTeX → HTML via KaTeX (Build-Zeit)
src/lib/xml/xref-resolver.ts        ← xml:id → URL + Label Map
src/lib/xml/docbook-ast.ts          ← TypeScript-Typen für den AST
src/lib/xml/course-registry.ts      ← Kurs-Discovery (scannt content/courses/)
        ↓
src/pages/[course]/[chapter].astro  ← Dynamische Routen via getStaticPaths()
src/components/ContentRenderer.astro ← Rekursiver AST→HTML Renderer
```

### Routing (Astro Static)

- `/` → Kurs-Übersicht (index.astro)
- `/<course>/` → Kurs-Startseite mit TOC
- `/<course>/<chapter>/` → Kapitel-Ansicht
- `/<course>/symbolverzeichnis/` → Symbolverzeichnis

### Layouts

- `PlatformLayout.astro` — Basis-HTML-Shell (Fonts, KaTeX-CSS, SearchModal)
- `CourseLayout.astro` — Sidebar-TOC, Glossar-Slideover, ScrollSpy, Copy-to-Clipboard

### Komponenten-Verzeichnisse

`src/components/` hat Unterordner: `academic/`, `glossary/`, `math/`, `navigation/`, `structural/`, `ui/` — aktuell leer, Komponenten liegen noch direkt in `components/`.

## Gotchas

- **BASE_PATH / SITE_URL**: Für GitHub Pages müssen Env-Vars gesetzt sein (`SITE_URL`, `BASE_PATH`). `astro.config.mjs` liest diese. Alle internen Links nutzen `import.meta.env.BASE_URL`.
- **Pagefind**: Search-Index wird als Post-Build-Schritt generiert (`scripts/build-search-index.mjs`). Nutzt die Pagefind-API programmatisch, nicht die CLI. Glossar-Symbole werden als Custom Records eingefügt.
- **KaTeX Build-Zeit**: Mathe wird beim XML-Parsing zu HTML gerendert (nicht client-seitig). CSS kommt vom CDN.
- **XInclude**: `parse-book.ts` löst `xi:include`-Elemente rekursiv auf.
- **xml:id-Konvention**: Kapitel = `ch.*`, Sections = `sec.*`, Appendices = `app.*`. Slugs werden via `idToSlug()` abgeleitet.
- **Globale Counter**: `equationCounter` und `figureCounter` in `parse-book.ts` sind modul-global und werden pro `parseBook()`-Aufruf zurückgesetzt.
- **Aktuell ein Kurs**: `content/courses/dynamik/`

## Code Style

- TypeScript für Library-Code (`src/lib/`), Astro-Komponenten für UI
- Tailwind für Utility-Klassen, Custom CSS in `src/styles/global.css`
- Kein Prettier/ESLint konfiguriert
- Deutsche UI-Texte (Breadcrumbs, Navigation, Tooltips)

## Qualitätsanspruch

- **Single Source of Truth**: Alle Inhalte leben in DocBook-5-XML. Daraus werden sowohl die Web-Version (Astro) als auch die Druck-/PDF-Version generiert.
- **Verlagstauglich**: Struktur, Typographie und Inhalt sollen dem Standard großer Fachverlage entsprechen.
- **Skalierbar**: Die Plattform ist auf mehrere Vorlesungen des INM ausgelegt (`content/courses/<slug>/`). Jeder Kurs ist ein eigenständiges DocBook-Buch mit eigenem Symbolverzeichnis.
- **Erweiterbar**: Neue Kurse durch Anlegen eines Ordners unter `content/courses/` mit `book.xml` und optionaler `glossary.xml`. Kurs-Discovery erfolgt automatisch via `course-registry.ts`.
