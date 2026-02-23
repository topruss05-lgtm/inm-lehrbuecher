// ═══════════════════════════════════════════════════════════════════
// Interactive Features: Collapsible TOC, Non-Blocking Glossary Panel,
// Context-to-Clipboard (h2 + h3)
// ═══════════════════════════════════════════════════════════════════

(function () {
  "use strict";

  var CLIPBOARD_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="8" height="10" rx="1"/><path d="M3 5v7a1 1 0 0 0 1 1h7"/></svg>';

  var CHECK_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 8 6.5 11.5 13 5"/></svg>';

  var BOOK_ICON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h4a2 2 0 0 1 2 2v8a1.5 1.5 0 0 0-1.5-1.5H2V3z"/><path d="M14 3h-4a2 2 0 0 0-2 2v8a1.5 1.5 0 0 1 1.5-1.5H14V3z"/></svg>';

  var CHEVRON_SVG = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 2 7 5 3 8"/></svg>';

  var glossary = [];

  // ─── Entry Point ──────────────────────────────────────────────

  window.initInteractive = async function () {
    try {
      var docBase = document.baseURI || window.location.href;
      var jsonUrl = new URL("glossary.json", docBase).href;
      var resp = await fetch(jsonUrl);
      if (!resp.ok) return;
      glossary = await resp.json();
    } catch (e) {
      console.warn("Symbol-Glossar nicht geladen:", e);
      return;
    }

    restructureSidebar();
    buildGlossaryAppendix();
    buildGlossarySlideover();
    addCopyButtons();
  };

  // ─── Sidebar Restructuring ──────────────────────────────────

  function restructureSidebar() {
    var toc = document.querySelector(".toc");
    if (!toc) return;

    var h2 = toc.querySelector("h2");
    var ol = toc.querySelector(":scope > ol");
    if (!h2 || !ol) return;

    // 1. Add glossary button at very top
    var glossaryBtn = document.createElement("button");
    glossaryBtn.className = "toc-glossary-btn";
    glossaryBtn.innerHTML = BOOK_ICON + " Symbolverzeichnis";
    glossaryBtn.addEventListener("click", function (e) {
      e.preventDefault();
      openGlossary();
    });
    toc.insertBefore(glossaryBtn, toc.firstChild);

    // 2. Make h2 a collapsible toggle
    h2.classList.add("toc-toggle");
    var chevronSpan = document.createElement("span");
    chevronSpan.className = "toc-chevron";
    chevronSpan.innerHTML = CHEVRON_SVG;
    h2.appendChild(chevronSpan);

    // 3. Wrap ol in scrollable toc-body
    var tocBody = document.createElement("div");
    tocBody.className = "toc-body";
    toc.insertBefore(tocBody, ol);
    tocBody.appendChild(ol);

    // Toggle entire TOC
    h2.addEventListener("click", function () {
      h2.classList.toggle("collapsed");
      tocBody.classList.toggle("collapsed");
    });

    // 4. Make each chapter's sub-sections collapsible
    var chapterItems = ol.querySelectorAll(":scope > li");
    chapterItems.forEach(function (li) {
      var subOl = li.querySelector(":scope > ol");
      if (!subOl || subOl.children.length === 0) return;

      var toggle = document.createElement("button");
      toggle.className = "chapter-toggle";
      toggle.innerHTML = CHEVRON_SVG;
      toggle.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        li.classList.toggle("sections-collapsed");
      });

      li.insertBefore(toggle, li.firstChild);
    });
  }

  // ─── Glossary Appendix (page bottom) ────────────────────────

  function buildGlossaryAppendix() {
    var main = document.querySelector("main");
    if (!main || glossary.length === 0) return;

    var section = document.createElement("section");
    section.id = "glossary-appendix";
    section.className = "glossary-appendix";

    var h2 = document.createElement("h2");
    h2.textContent = "Symbolverzeichnis";
    section.appendChild(h2);

    section.appendChild(buildNotationTable());
    main.appendChild(section);

    // Add link to TOC
    var tocOl = document.querySelector(".toc-body > ol");
    if (tocOl) {
      var li = document.createElement("li");
      li.style.marginTop = "0.5rem";
      var a = document.createElement("a");
      a.href = "#glossary-appendix";
      a.textContent = "Symbolverzeichnis";
      a.style.fontStyle = "italic";
      li.appendChild(a);
      tocOl.appendChild(li);
    }
  }

  // ─── Glossary Slide-Over Panel (non-blocking) ───────────────

  function buildGlossarySlideover() {
    if (glossary.length === 0) return;

    var panel = document.createElement("div");
    panel.className = "glossary-slideover";
    panel.id = "glossary-slideover";

    // Header
    var header = document.createElement("div");
    header.className = "slideover-header";

    var h3 = document.createElement("h3");
    h3.textContent = "Symbolverzeichnis";
    header.appendChild(h3);

    var closeBtn = document.createElement("button");
    closeBtn.className = "slideover-close";
    closeBtn.setAttribute("aria-label", "Schließen");
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", closeGlossary);
    header.appendChild(closeBtn);

    panel.appendChild(header);

    // Body with table
    var body = document.createElement("div");
    body.className = "slideover-body";
    var table = buildNotationTable();
    table.id = "slideover-notation-table";
    body.appendChild(table);
    panel.appendChild(body);

    document.body.appendChild(panel);

    // Escape key
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeGlossary();
    });
  }

  function buildNotationTable() {
    var table = document.createElement("table");
    table.className = "notation-table";

    var thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>Symbol</th><th>Name</th><th>Beschreibung</th><th>Einheit</th></tr>";
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    var sorted = getSortedGlossary();
    sorted.forEach(function (sym) {
      var tr = document.createElement("tr");
      tr.setAttribute("data-symbol-id", sym.id);

      var tdSym = document.createElement("td");
      tdSym.className = "notation-symbol-cell";
      try {
        katex.render(sym.latex, tdSym, { throwOnError: false });
      } catch (e) {
        tdSym.textContent = sym.latex;
      }

      var tdName = document.createElement("td");
      tdName.textContent = sym.name;

      var tdDesc = document.createElement("td");
      tdDesc.className = "notation-desc-cell";
      tdDesc.textContent = sym.description;

      var tdUnit = document.createElement("td");
      tdUnit.textContent = sym.unit || "\u2014";

      tr.appendChild(tdSym);
      tr.appendChild(tdName);
      tr.appendChild(tdDesc);
      tr.appendChild(tdUnit);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    return table;
  }

  function getSortedGlossary() {
    var categoryOrder = ["energy", "inertia", "dynamics", "system", "coordinates",
                         "kinematics", "forces", "conservation", "variational"];
    var sorted = glossary.slice();
    sorted.sort(function (a, b) {
      var ia = categoryOrder.indexOf(a.category || "");
      var ib = categoryOrder.indexOf(b.category || "");
      if (ia === -1) ia = 99;
      if (ib === -1) ib = 99;
      if (ia !== ib) return ia - ib;
      return (a.name || "").localeCompare(b.name || "");
    });
    return sorted;
  }

  // ─── Glossary Open/Close (non-blocking) ─────────────────────

  function openGlossary() {
    var panel = document.getElementById("glossary-slideover");
    if (panel) {
      panel.classList.add("open");
      updateGlossaryContext();
    }
  }

  function closeGlossary() {
    var panel = document.getElementById("glossary-slideover");
    if (panel) panel.classList.remove("open");
  }

  // ─── Context-Sensitive Symbol Highlighting ──────────────────

  function updateGlossaryContext() {
    var table = document.getElementById("slideover-notation-table");
    if (!table) return;

    // Find the section currently visible in the viewport
    var section = findVisibleSection();
    var rows = table.querySelectorAll("tbody tr");

    if (!section) {
      rows.forEach(function (tr) {
        tr.classList.remove("symbol-relevant", "symbol-dimmed");
      });
      return;
    }

    var usedIds = getSymbolsUsedInElement(section);
    var tbody = table.querySelector("tbody");
    var relevantRows = [];
    var otherRows = [];

    rows.forEach(function (tr) {
      var symId = tr.getAttribute("data-symbol-id");
      tr.classList.remove("symbol-relevant", "symbol-dimmed");
      if (usedIds.has(symId)) {
        tr.classList.add("symbol-relevant");
        relevantRows.push(tr);
      } else {
        tr.classList.add("symbol-dimmed");
        otherRows.push(tr);
      }
    });

    relevantRows.forEach(function (tr) { tbody.appendChild(tr); });
    otherRows.forEach(function (tr) { tbody.appendChild(tr); });
  }

  function findVisibleSection() {
    var sections = document.querySelectorAll("section.section[id]");
    var best = null;
    var bestScore = -Infinity;
    var viewportMid = window.innerHeight / 2;

    for (var i = 0; i < sections.length; i++) {
      var rect = sections[i].getBoundingClientRect();
      // Prefer sections whose top is closest to the viewport middle
      var score = -Math.abs(rect.top - viewportMid);
      if (rect.bottom > 0 && rect.top < window.innerHeight && score > bestScore) {
        bestScore = score;
        best = sections[i];
      }
    }
    return best;
  }

  function getSymbolsUsedInElement(element) {
    var latexEls = element.querySelectorAll("[data-latex]");
    var usedIds = new Set();

    latexEls.forEach(function (el) {
      var tex = el.getAttribute("data-latex") || "";
      glossary.forEach(function (sym) {
        if (containsSymbol(tex, sym.latex)) {
          usedIds.add(sym.id);
        }
      });
    });

    return usedIds;
  }

  function containsSymbol(tex, symLatex) {
    if (symLatex.length === 1) {
      var re = new RegExp("(?<![a-zA-Z\\\\])" + escapeRegex(symLatex) + "(?![a-zA-Z])");
      return re.test(tex);
    }
    return tex.indexOf(symLatex) !== -1;
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // ─── Copy Buttons (h2 + h3) ─────────────────────────────────

  function addCopyButtons() {
    // Chapter headings (h2)
    var chapters = document.querySelectorAll("article.chapter > h2");
    chapters.forEach(function (h2) {
      var btn = createCopyButton("Kapitel kopieren");
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var chapter = h2.closest("article.chapter");
        copyContext(chapter, btn, "chapter");
      });
      h2.appendChild(btn);
    });

    // Section headings (h3)
    var sections = document.querySelectorAll("section.section");
    sections.forEach(function (section) {
      var h3 = section.querySelector(":scope > h3");
      if (!h3) return;

      var btn = createCopyButton("Abschnitt kopieren");
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        copyContext(section, btn, "section");
      });
      h3.appendChild(btn);
    });
  }

  function createCopyButton(title) {
    var btn = document.createElement("button");
    btn.className = "copy-context-btn";
    btn.setAttribute("aria-label", title);
    btn.setAttribute("title", title);
    btn.innerHTML = CLIPBOARD_ICON;
    return btn;
  }

  // ─── Copy Context ───────────────────────────────────────────

  async function copyContext(element, btn, level) {
    var markdown = "";

    if (level === "chapter") {
      var chapterTitle = getCleanText(element.querySelector(":scope > h2"));
      markdown += "# " + chapterTitle + "\n\n";
      markdown += extractChapterContent(element);
    } else {
      var chapter = element.closest("article.chapter");
      var chapterTitle = chapter ? getCleanText(chapter.querySelector(":scope > h2")) : "";
      var sectionTitle = getCleanText(element.querySelector(":scope > h3"));
      markdown += "## Kontext: " + chapterTitle + "\n";
      markdown += "### " + sectionTitle + "\n\n";
      markdown += extractSectionContent(element);
    }

    // Always append glossary
    markdown += "\n---\n\n";
    markdown += buildGlossaryMarkdown();

    try {
      await navigator.clipboard.writeText(markdown);
      showCopyFeedback(btn);
      showToast(level === "chapter" ? "Kapitel kopiert" : "Abschnitt kopiert");
    } catch (e) {
      fallbackCopy(markdown);
      showCopyFeedback(btn);
      showToast(level === "chapter" ? "Kapitel kopiert" : "Abschnitt kopiert");
    }
  }

  function getCleanText(el) {
    if (!el) return "";
    var clone = el.cloneNode(true);
    var btns = clone.querySelectorAll(".copy-context-btn");
    btns.forEach(function (b) { b.remove(); });
    return clone.textContent.trim();
  }

  // ─── Content Extraction ─────────────────────────────────────

  function extractChapterContent(chapter) {
    var parts = [];
    var children = chapter.children;

    for (var i = 0; i < children.length; i++) {
      var el = children[i];
      if (el.matches("h2")) continue;

      if (el.matches("section.section")) {
        var sectionTitle = getCleanText(el.querySelector(":scope > h3"));
        if (sectionTitle) parts.push("\n## " + sectionTitle + "\n");
        parts.push(extractSectionContent(el));
      } else {
        extractElement(el, parts);
      }
    }

    return parts.join("\n");
  }

  function extractSectionContent(section) {
    var parts = [];
    var children = section.children;

    for (var i = 0; i < children.length; i++) {
      var el = children[i];
      if (el.matches("h3, h4")) continue;

      if (el.matches("section.subsection")) {
        var subTitle = getCleanText(el.querySelector(":scope > h4"));
        if (subTitle) parts.push("\n### " + subTitle + "\n");
        var subChildren = el.children;
        for (var j = 0; j < subChildren.length; j++) {
          if (!subChildren[j].matches("h4")) {
            extractElement(subChildren[j], parts);
          }
        }
        continue;
      }

      extractElement(el, parts);
    }

    return parts.join("\n");
  }

  function extractElement(el, parts) {
    if (el.matches("p")) {
      parts.push(extractParagraph(el));
    } else if (el.matches(".math-display")) {
      var latex = el.getAttribute("data-latex") || "";
      if (latex) parts.push("\n$$" + stripDelimiters(latex) + "$$\n");
    } else if (el.matches(".equation-wrapper")) {
      var eqDiv = el.querySelector(".equation");
      var eqNum = el.querySelector(".equation-number");
      var latex = eqDiv ? (eqDiv.getAttribute("data-latex") || "") : "";
      var num = eqNum ? eqNum.textContent.trim() : "";
      if (latex) parts.push("\n$$" + stripDelimiters(latex) + "$$" + (num ? "  " + num : "") + "\n");
    } else if (el.matches(".formalpara")) {
      var title = el.querySelector(".formalpara-title");
      var body = el.querySelector(".formalpara-body");
      if (title) parts.push("\n**" + title.textContent.trim() + "**\n");
      if (body) {
        var paras = body.querySelectorAll("p");
        paras.forEach(function (p) { parts.push(extractParagraph(p)); });
      }
    }
  }

  function extractParagraph(p) {
    var result = "";
    p.childNodes.forEach(function (node) {
      if (node.nodeType === 3) {
        result += node.textContent;
      } else if (node.nodeType === 1) {
        if (node.matches && node.matches(".math-inline")) {
          var latex = node.getAttribute("data-latex") || "";
          result += latex || node.textContent;
        } else if (node.matches && node.matches("strong")) {
          result += "**" + node.textContent + "**";
        } else if (node.matches && node.matches("em")) {
          result += "*" + node.textContent + "*";
        } else {
          result += node.textContent;
        }
      }
    });
    return result.trim();
  }

  function stripDelimiters(latex) {
    return latex.replace(/^\s*\\\[\s*/, "").replace(/\s*\\\]\s*$/, "").trim();
  }

  // ─── Glossary Markdown (for clipboard) ──────────────────────

  function buildGlossaryMarkdown() {
    var md = "## Symbolverzeichnis\n\n";
    md += "| Symbol | Name | Beschreibung | Einheit |\n";
    md += "|--------|------|--------------|--------|\n";
    getSortedGlossary().forEach(function (sym) {
      var unit = sym.unit || "\u2014";
      md += "| $" + sym.latex + "$ | " + sym.name + " | " + sym.description + " | " + unit + " |\n";
    });
    return md;
  }

  // ─── UI Feedback ────────────────────────────────────────────

  function showCopyFeedback(btn) {
    var original = btn.innerHTML;
    btn.innerHTML = CHECK_ICON;
    btn.classList.add("copy-success");
    setTimeout(function () {
      btn.innerHTML = original;
      btn.classList.remove("copy-success");
    }, 1500);
  }

  var toastTimeout = null;

  function showToast(message) {
    var existing = document.getElementById("copy-toast");
    if (existing) existing.remove();

    var toast = document.createElement("div");
    toast.id = "copy-toast";
    toast.className = "copy-toast";
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add("visible");
    });

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(function () {
      toast.classList.remove("visible");
      setTimeout(function () { toast.remove(); }, 200);
    }, 2000);
  }

  function fallbackCopy(text) {
    var textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.cssText = "position:fixed;left:-9999px;top:-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    try { document.execCommand("copy"); } catch (e) { /* ignore */ }
    document.body.removeChild(textarea);
  }

})();
