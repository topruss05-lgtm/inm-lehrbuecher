<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:db="http://docbook.org/ns/docbook"
  xmlns:xi="http://www.w3.org/2001/XInclude"
  exclude-result-prefixes="db xi">

  <xsl:output method="html" encoding="UTF-8" indent="yes"
              doctype-system="about:legacy-compat"/>

  <!-- ════════════════════════════════════════════════════════════════ -->
  <!-- Root: <book> → HTML5 document                                   -->
  <!-- ════════════════════════════════════════════════════════════════ -->
  <xsl:template match="db:book">
    <html lang="de">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title><xsl:value-of select="db:info/db:title"/></title>
        <link rel="stylesheet" href="../style.css"/>
        <link rel="stylesheet"
              href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css"
              crossorigin="anonymous"/>
      </head>
      <body>
        <header class="book-header">
          <h1><xsl:value-of select="db:info/db:title"/></h1>
          <p class="subtitle"><xsl:value-of select="db:info/db:subtitle"/></p>
        </header>

        <div class="layout-wrapper">
          <nav id="toc" class="toc" aria-label="Inhaltsverzeichnis">
            <h2>Inhaltsverzeichnis</h2>
            <ol>
              <xsl:for-each select="db:chapter">
                <li>
                  <a href="#{@xml:id}"><xsl:number count="db:chapter"/><xsl:text>. </xsl:text><xsl:value-of select="db:title"/></a>
                  <ol>
                    <xsl:for-each select="db:section">
                      <li><a href="#{@xml:id}"><xsl:value-of select="db:title"/></a></li>
                    </xsl:for-each>
                  </ol>
                </li>
              </xsl:for-each>
            </ol>
          </nav>

          <main>
            <xsl:apply-templates select="db:chapter"/>
          </main>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.js"
                crossorigin="anonymous"></script>
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/contrib/auto-render.min.js"
                crossorigin="anonymous"></script>
        <script>
          document.addEventListener("DOMContentLoaded", function() {
            renderMathInElement(document.body, {
              delimiters: [
                {left: "\\[", right: "\\]", display: true},
                {left: "$", right: "$", display: false}
              ],
              ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
              throwOnError: false
            });
            if (window.initInteractive) window.initInteractive();
          });
        </script>
        <script src="../interactive.js" defer="defer"></script>
      </body>
    </html>
  </xsl:template>

  <!-- ════════════════════════════════════════════════════════════════ -->
  <!-- Structure: chapter, section                                     -->
  <!-- ════════════════════════════════════════════════════════════════ -->
  <xsl:template match="db:chapter">
    <article class="chapter">
      <xsl:if test="@xml:id">
        <xsl:attribute name="id"><xsl:value-of select="@xml:id"/></xsl:attribute>
      </xsl:if>
      <h2><xsl:number count="db:chapter"/><xsl:text>. </xsl:text><xsl:value-of select="db:title"/></h2>
      <xsl:apply-templates select="*[not(self::db:title)]"/>
    </article>
  </xsl:template>

  <xsl:template match="db:chapter/db:section">
    <section class="section">
      <xsl:if test="@xml:id">
        <xsl:attribute name="id"><xsl:value-of select="@xml:id"/></xsl:attribute>
      </xsl:if>
      <h3><xsl:apply-templates select="db:title/node()"/></h3>
      <xsl:apply-templates select="*[not(self::db:title)]"/>
    </section>
  </xsl:template>

  <xsl:template match="db:section/db:section">
    <section class="subsection">
      <xsl:if test="@xml:id">
        <xsl:attribute name="id"><xsl:value-of select="@xml:id"/></xsl:attribute>
      </xsl:if>
      <h4><xsl:apply-templates select="db:title/node()"/></h4>
      <xsl:apply-templates select="*[not(self::db:title)]"/>
    </section>
  </xsl:template>

  <!-- ════════════════════════════════════════════════════════════════ -->
  <!-- Paragraphs                                                      -->
  <!-- ════════════════════════════════════════════════════════════════ -->
  <xsl:template match="db:para">
    <p><xsl:apply-templates/></p>
  </xsl:template>

  <!-- ════════════════════════════════════════════════════════════════ -->
  <!-- Math: inline, display, numbered                                 -->
  <!-- ════════════════════════════════════════════════════════════════ -->
  <xsl:template match="db:inlineequation">
    <span class="math-inline">
      <xsl:attribute name="data-latex"><xsl:value-of select="db:alt"/></xsl:attribute>
      <xsl:value-of select="db:alt"/>
    </span>
  </xsl:template>

  <xsl:template match="db:informalequation">
    <div class="math-display">
      <xsl:attribute name="data-latex"><xsl:value-of select="db:alt"/></xsl:attribute>
      <xsl:value-of select="db:alt"/>
    </div>
  </xsl:template>

  <xsl:template match="db:equation">
    <div class="equation-wrapper">
      <xsl:if test="@xml:id">
        <xsl:attribute name="id"><xsl:value-of select="@xml:id"/></xsl:attribute>
      </xsl:if>
      <xsl:if test="db:title">
        <span class="equation-title"><xsl:value-of select="db:title"/></span>
      </xsl:if>
      <div class="equation">
        <xsl:attribute name="data-latex"><xsl:value-of select="db:alt"/></xsl:attribute>
        <xsl:value-of select="db:alt"/>
      </div>
      <span class="equation-number">
        (<xsl:number count="db:equation" level="any"/>)
      </span>
    </div>
  </xsl:template>

  <!-- ════════════════════════════════════════════════════════════════ -->
  <!-- Theorem-like environments: formalpara                           -->
  <!-- ════════════════════════════════════════════════════════════════ -->
  <xsl:template match="db:formalpara[@role]">
    <div>
      <xsl:attribute name="class">formalpara formalpara-<xsl:value-of select="@role"/></xsl:attribute>
      <xsl:if test="@xml:id">
        <xsl:attribute name="id"><xsl:value-of select="@xml:id"/></xsl:attribute>
      </xsl:if>
      <p class="formalpara-title"><xsl:apply-templates select="db:title/node()"/></p>
      <div class="formalpara-body">
        <xsl:apply-templates select="db:para"/>
      </div>
    </div>
  </xsl:template>

  <xsl:template match="db:formalpara[not(@role)]">
    <div class="formalpara formalpara-generic">
      <xsl:if test="@xml:id">
        <xsl:attribute name="id"><xsl:value-of select="@xml:id"/></xsl:attribute>
      </xsl:if>
      <p class="formalpara-title"><xsl:apply-templates select="db:title/node()"/></p>
      <div class="formalpara-body">
        <xsl:apply-templates select="db:para"/>
      </div>
    </div>
  </xsl:template>

  <!-- ════════════════════════════════════════════════════════════════ -->
  <!-- Examples                                                        -->
  <!-- ════════════════════════════════════════════════════════════════ -->
  <xsl:template match="db:example">
    <div class="example">
      <xsl:if test="@xml:id">
        <xsl:attribute name="id"><xsl:value-of select="@xml:id"/></xsl:attribute>
      </xsl:if>
      <p class="example-title"><xsl:value-of select="db:title"/></p>
      <div class="example-body">
        <xsl:apply-templates select="*[not(self::db:title)]"/>
      </div>
    </div>
  </xsl:template>

  <!-- ════════════════════════════════════════════════════════════════ -->
  <!-- Figures (text-only placeholders)                                -->
  <!-- ════════════════════════════════════════════════════════════════ -->
  <xsl:template match="db:figure">
    <figure class="figure">
      <xsl:if test="@xml:id">
        <xsl:attribute name="id"><xsl:value-of select="@xml:id"/></xsl:attribute>
      </xsl:if>
      <div class="figure-placeholder">
        <p class="figure-description">
          <xsl:value-of select=".//db:phrase"/>
        </p>
      </div>
      <figcaption>
        <xsl:text>Abb. </xsl:text>
        <xsl:number count="db:figure" level="any"/>
        <xsl:text>: </xsl:text>
        <xsl:value-of select="db:title"/>
      </figcaption>
    </figure>
  </xsl:template>

  <!-- ════════════════════════════════════════════════════════════════ -->
  <!-- Tables (CALS model)                                             -->
  <!-- ════════════════════════════════════════════════════════════════ -->
  <xsl:template match="db:table">
    <div class="table-wrapper">
      <xsl:if test="@xml:id">
        <xsl:attribute name="id"><xsl:value-of select="@xml:id"/></xsl:attribute>
      </xsl:if>
      <table>
        <caption><xsl:value-of select="db:title"/></caption>
        <xsl:apply-templates select="db:tgroup"/>
      </table>
    </div>
  </xsl:template>

  <xsl:template match="db:tgroup">
    <xsl:apply-templates select="db:thead|db:tbody"/>
  </xsl:template>

  <xsl:template match="db:thead">
    <thead><xsl:apply-templates select="db:row"/></thead>
  </xsl:template>

  <xsl:template match="db:tbody">
    <tbody><xsl:apply-templates select="db:row"/></tbody>
  </xsl:template>

  <xsl:template match="db:row">
    <tr><xsl:apply-templates select="db:entry"/></tr>
  </xsl:template>

  <xsl:template match="db:thead/db:row/db:entry">
    <th><xsl:apply-templates/></th>
  </xsl:template>

  <xsl:template match="db:tbody/db:row/db:entry">
    <td><xsl:apply-templates/></td>
  </xsl:template>

  <!-- ════════════════════════════════════════════════════════════════ -->
  <!-- Emphasis variants                                               -->
  <!-- ════════════════════════════════════════════════════════════════ -->
  <xsl:template match="db:emphasis[@role='bold']">
    <strong><xsl:apply-templates/></strong>
  </xsl:template>

  <xsl:template match="db:emphasis[@role='underline']">
    <span class="underline"><xsl:apply-templates/></span>
  </xsl:template>

  <xsl:template match="db:emphasis[starts-with(@role, 'color-')]">
    <span>
      <xsl:attribute name="class"><xsl:value-of select="@role"/></xsl:attribute>
      <xsl:apply-templates/>
    </span>
  </xsl:template>

  <xsl:template match="db:emphasis[not(@role)]">
    <em><xsl:apply-templates/></em>
  </xsl:template>

  <!-- ════════════════════════════════════════════════════════════════ -->
  <!-- Lists                                                           -->
  <!-- ════════════════════════════════════════════════════════════════ -->
  <xsl:template match="db:orderedlist">
    <ol><xsl:apply-templates select="db:listitem"/></ol>
  </xsl:template>

  <xsl:template match="db:itemizedlist">
    <ul><xsl:apply-templates select="db:listitem"/></ul>
  </xsl:template>

  <xsl:template match="db:listitem">
    <li><xsl:apply-templates/></li>
  </xsl:template>

  <!-- ════════════════════════════════════════════════════════════════ -->
  <!-- Suppress standalone info (already handled in book template)     -->
  <!-- ════════════════════════════════════════════════════════════════ -->
  <xsl:template match="db:info"/>

  <!-- ════════════════════════════════════════════════════════════════ -->
  <!-- Default: pass through text, suppress unknown elements           -->
  <!-- ════════════════════════════════════════════════════════════════ -->
  <xsl:template match="text()">
    <xsl:value-of select="."/>
  </xsl:template>

</xsl:stylesheet>
