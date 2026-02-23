<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sg="urn:dynamik:symbols"
  exclude-result-prefixes="sg">

  <xsl:output method="text" encoding="UTF-8"/>

  <!-- ════════════════════════════════════════════════════════════════ -->
  <!-- Root: symbol-glossary → JSON array                              -->
  <!-- ════════════════════════════════════════════════════════════════ -->
  <xsl:template match="sg:symbol-glossary">
    <xsl:text>[</xsl:text>
    <xsl:for-each select="sg:symbol">
      <xsl:if test="position() > 1">
        <xsl:text>,&#10;</xsl:text>
      </xsl:if>
      <xsl:call-template name="symbol-to-json"/>
    </xsl:for-each>
    <xsl:text>&#10;]&#10;</xsl:text>
  </xsl:template>

  <!-- ════════════════════════════════════════════════════════════════ -->
  <!-- Single symbol → JSON object                                     -->
  <!-- ════════════════════════════════════════════════════════════════ -->
  <xsl:template name="symbol-to-json">
    <xsl:text>{"id":"</xsl:text>
    <xsl:value-of select="@id"/>

    <xsl:text>","latex":"</xsl:text>
    <xsl:call-template name="escape-json">
      <xsl:with-param name="text" select="sg:latex"/>
    </xsl:call-template>

    <xsl:text>","name":"</xsl:text>
    <xsl:call-template name="escape-json">
      <xsl:with-param name="text" select="sg:name"/>
    </xsl:call-template>

    <xsl:text>","description":"</xsl:text>
    <xsl:call-template name="escape-json">
      <xsl:with-param name="text" select="normalize-space(sg:description)"/>
    </xsl:call-template>
    <xsl:text>"</xsl:text>

    <xsl:if test="sg:unit">
      <xsl:text>,"unit":"</xsl:text>
      <xsl:call-template name="escape-json">
        <xsl:with-param name="text" select="sg:unit"/>
      </xsl:call-template>
      <xsl:text>"</xsl:text>
    </xsl:if>

    <xsl:if test="@category">
      <xsl:text>,"category":"</xsl:text>
      <xsl:value-of select="@category"/>
      <xsl:text>"</xsl:text>
    </xsl:if>

    <xsl:if test="sg:see-also">
      <xsl:text>,"seeAlso":"</xsl:text>
      <xsl:value-of select="sg:see-also"/>
      <xsl:text>"</xsl:text>
    </xsl:if>

    <xsl:if test="sg:context/@chapters">
      <xsl:text>,"chapters":"</xsl:text>
      <xsl:value-of select="sg:context/@chapters"/>
      <xsl:text>"</xsl:text>
    </xsl:if>

    <xsl:text>}</xsl:text>
  </xsl:template>

  <!-- ════════════════════════════════════════════════════════════════ -->
  <!-- Helper: escape backslashes and quotes for JSON                  -->
  <!-- ════════════════════════════════════════════════════════════════ -->
  <xsl:template name="escape-json">
    <xsl:param name="text"/>
    <xsl:call-template name="string-replace">
      <xsl:with-param name="text">
        <xsl:call-template name="string-replace">
          <xsl:with-param name="text" select="$text"/>
          <xsl:with-param name="from">\</xsl:with-param>
          <xsl:with-param name="to">\\</xsl:with-param>
        </xsl:call-template>
      </xsl:with-param>
      <xsl:with-param name="from">"</xsl:with-param>
      <xsl:with-param name="to">\"</xsl:with-param>
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="string-replace">
    <xsl:param name="text"/>
    <xsl:param name="from"/>
    <xsl:param name="to"/>
    <xsl:choose>
      <xsl:when test="contains($text, $from)">
        <xsl:value-of select="substring-before($text, $from)"/>
        <xsl:value-of select="$to"/>
        <xsl:call-template name="string-replace">
          <xsl:with-param name="text" select="substring-after($text, $from)"/>
          <xsl:with-param name="from" select="$from"/>
          <xsl:with-param name="to" select="$to"/>
        </xsl:call-template>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$text"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

</xsl:stylesheet>
