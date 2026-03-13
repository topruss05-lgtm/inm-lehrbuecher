#!/usr/bin/env python3
"""
SVG Cleanup: Combine vector drawings from PDF-extracted SVGs with properly decoded
text labels from PyMuPDF's text extraction.

1. Drawing paths: from SVG extraction (text_as_path=True) — correct visuals
2. Text labels: from page.get_text("dict") — real characters
3. Coordinate normalization, style deduplication, semantic grouping
"""

import pymupdf
import xml.etree.ElementTree as ET
import re
import sys
import math
from pathlib import Path

SVG_NS = "http://www.w3.org/2000/svg"
XLINK_NS = "http://www.w3.org/1999/xlink"

PDF_PATH = Path(__file__).parent / "Aufgabensammlung DMS.pdf"

# ── Known wrong font mappings (WinAnsiEncoding → actual TeX glyph) ────────
# ComputerModernMathItalic/LatexItalic fonts use WinAnsiEncoding but have
# TeX math glyphs at extended positions. These are the corrections.
CHAR_CORRECTIONS = {
    # TeX CMMI low-byte positions (WinAnsi fallback)
    '!': 'ω',     # 0x21 → omega
    '"': 'ε',     # 0x22 → varepsilon
    '#': 'ϑ',     # 0x23 → vartheta
    '%': 'ϱ',     # 0x25 → varrho
    "'": 'φ',     # 0x27 → varphi
    # High-byte positions
    '£': 'ω',     # 0xA3 → omega
    '®': 'δ',     # 0xAE → delta
    '¯': 'ε',     # 0xAF → varepsilon
    '°': '∘',     # 0xB0 → ring/composition
    '±': '±',     # 0xB1 → actually correct
    '´': '′',     # 0xB4 → prime
    '½': '·',     # 0xBD → center dot
    'Ã': 'ψ',     # 0xC3 → psi
    'Ä': '¨',     # 0xC4 → umlaut/dieresis
    '»': 'L',     # 0xBB → script L (Lagrangian)
    '\x00': '',   # null → skip
    '\x01': '',   # SOH → skip
}

# Fonts that need character correction
CORRECTION_FONTS = {
    "ComputerModernMathItalic", "ComputerModernMathItalics",
    "LatexItalic-Italic-Norma", "LatexItalic-NormalItalic",
    "ComputerModernRoman", "ComputerModernRoman-Bold",
    "ComputerModernRoman-Norm", "ComputerModernCalligraph",
}

def _load_font_b64():
    """Load the subsetted Latin Modern Math font as base64."""
    import base64
    font_path = Path(__file__).parent / "lm-math-subset.woff2"
    if font_path.exists():
        with open(font_path, "rb") as f:
            return base64.b64encode(f.read()).decode()
    return None

_FONT_B64 = _load_font_b64()

def get_style_block():
    font_face = ""
    if _FONT_B64:
        font_face = f"""    @font-face {{
      font-family: 'LM Math';
      src: url('data:font/woff2;base64,{_FONT_B64}') format('woff2');
      font-weight: normal;
      font-style: normal;
    }}
"""
    font_family = "'LM Math', 'Latin Modern Math', 'STIX Two Math', serif" if _FONT_B64 else "'Latin Modern Math', 'STIX Two Math', serif"
    return f"""{font_face}    .line {{ stroke: #231f20; fill: none; stroke-width: 0.567; }}
    .line-thick {{ stroke: #231f20; fill: none; stroke-width: 1.134; }}
    .line-bg {{ stroke: #fff; fill: none; stroke-width: 2.835; }}
    .bg-fill {{ fill: #fff; stroke: none; }}
    .hatch {{ stroke: #231f20; fill: none; stroke-width: 0.504; }}
    .filled {{ fill: #231f20; fill-rule: evenodd; }}
    .axis {{ stroke: #231f20; fill: none; stroke-width: 0.567; }}
    .label {{ font-family: {font_family}; fill: #231f20; stroke: none; }}"""


# ── Style classification ───────────────────────────────────────────────────

def classify_style(attrs):
    fill = attrs.get("fill", "")
    stroke = attrs.get("stroke", "")
    sw = float(attrs.get("stroke-width", "0") or "0")
    dasharray = attrs.get("stroke-dasharray", "")

    if fill == "#ffffff":
        return "bg-fill"
    if stroke == "#ffffff":
        return "line-bg"
    if fill and fill != "none":
        return "filled"
    if dasharray:
        return "axis"
    if 0 < sw < 0.52:
        return "hatch"
    if sw >= 1.0:
        return "line-thick"
    return "line"


# ── Coordinate helpers ─────────────────────────────────────────────────────

def parse_matrix(s):
    if not s:
        return None
    m = re.match(r"matrix\(([^)]+)\)", s)
    return tuple(float(v) for v in m.group(1).split(",")) if m else None


def apply_mx(mx, x, y):
    a, b, c, d, e, f = mx
    return (a * x + c * y + e, b * x + d * y + f)


def R(v, n=1):
    return round(v, n)


# ── Path data transformation ──────────────────────────────────────────────

def tokenize(d):
    return re.findall(r'[MmLlHhVvCcSsQqTtAaZz]|[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?', d)


def transform_path(d, mx):
    tokens = tokenize(d)
    out = []
    i, cmd = 0, None
    while i < len(tokens):
        t = tokens[i]
        if t.isalpha():
            cmd = t
            out.append(cmd)
            i += 1
            continue
        if cmd in ('M', 'L', 'T'):
            x, y = float(t), float(tokens[i+1])
            nx, ny = apply_mx(mx, x, y)
            out.append(f"{R(nx)} {R(ny)}")
            i += 2
        elif cmd in ('m', 'l', 't'):
            dx, dy = float(t), float(tokens[i+1])
            a, b, c, d_, _, _ = mx
            out.append(f"{R(a*dx+c*dy)} {R(b*dx+d_*dy)}")
            i += 2
        elif cmd == 'H':
            nx, _ = apply_mx(mx, float(t), 0)
            out.append(f"{R(nx)}")
            i += 1
        elif cmd == 'V':
            _, ny = apply_mx(mx, 0, float(t))
            out.append(f"{R(ny)}")
            i += 1
        elif cmd == 'h':
            out.append(f"{R(mx[0]*float(t))}")
            i += 1
        elif cmd == 'v':
            out.append(f"{R(mx[3]*float(t))}")
            i += 1
        elif cmd == 'C':
            pts = []
            for _ in range(3):
                x, y = float(tokens[i]), float(tokens[i+1])
                nx, ny = apply_mx(mx, x, y)
                pts.append(f"{R(nx)} {R(ny)}")
                i += 2
            out.append(" ".join(pts))
        elif cmd == 'c':
            a, b_, c_, d_, _, _ = mx
            pts = []
            for _ in range(3):
                dx, dy = float(tokens[i]), float(tokens[i+1])
                pts.append(f"{R(a*dx+c_*dy)} {R(b_*dx+d_*dy)}")
                i += 2
            out.append(" ".join(pts))
        elif cmd in ('S', 'Q'):
            pts = []
            for _ in range(2):
                x, y = float(tokens[i]), float(tokens[i+1])
                nx, ny = apply_mx(mx, x, y)
                pts.append(f"{R(nx)} {R(ny)}")
                i += 2
            out.append(" ".join(pts))
        elif cmd in ('Z', 'z'):
            pass
        else:
            out.append(t)
            i += 1
    return " ".join(out)


def shift_path(d, dx, dy):
    tokens = tokenize(d)
    out = []
    i, cmd = 0, None
    while i < len(tokens):
        t = tokens[i]
        if t.isalpha():
            cmd = t
            out.append(cmd)
            i += 1
            continue
        if cmd in ('M', 'L', 'T'):
            out.append(f"{R(float(t)+dx)} {R(float(tokens[i+1])+dy)}")
            i += 2
        elif cmd == 'C':
            pts = []
            for _ in range(3):
                pts.append(f"{R(float(tokens[i])+dx)} {R(float(tokens[i+1])+dy)}")
                i += 2
            out.append(" ".join(pts))
        elif cmd in ('S', 'Q'):
            pts = []
            for _ in range(2):
                pts.append(f"{R(float(tokens[i])+dx)} {R(float(tokens[i+1])+dy)}")
                i += 2
            out.append(" ".join(pts))
        elif cmd == 'H':
            out.append(f"{R(float(t)+dx)}")
            i += 1
        elif cmd == 'V':
            out.append(f"{R(float(t)+dy)}")
            i += 1
        elif cmd in ('m', 'l', 'c', 's', 'q', 't', 'h', 'v'):
            out.append(t)
            i += 1
        elif cmd in ('Z', 'z'):
            pass
        else:
            out.append(t)
            i += 1
    return " ".join(out)


# ── Geometry detection ─────────────────────────────────────────────────────

def detect_rect(d):
    toks = tokenize(d)
    cmds = "".join(t for t in toks if t.isalpha())
    if cmds in ("MHVHZ", "MHVH", "MVHVZ", "MVHV"):
        nums = [float(t) for t in toks if not t.isalpha()]
        try:
            if cmds.startswith("MH"):
                x1, y1, x2, y2, x3 = nums[:5]
                xn, xx = min(x1, x2, x3), max(x1, x2, x3)
                yn, yx = min(y1, y2), max(y1, y2)
            else:
                x1, y1, y2, x2, y3 = nums[:5]
                xn, xx = min(x1, x2), max(x1, x2)
                yn, yx = min(y1, y2, y3), max(y1, y2, y3)
            w, h = R(xx - xn), R(yx - yn)
            if w > 0.5 and h > 0.5:
                return (R(xn), R(yn), w, h)
        except (ValueError, IndexError):
            pass
    return None


def detect_circle(d):
    toks = tokenize(d)
    cmds = [t for t in toks if t.isalpha()]
    nums = [float(t) for t in toks if not t.isalpha()]
    if len(cmds) >= 5 and cmds[0] == 'M' and all(c == 'C' for c in cmds[1:5]) and len(nums) >= 26:
        pts = [(nums[0], nums[1])]
        idx = 2
        for _ in range(4):
            pts.append((nums[idx + 4], nums[idx + 5]))
            idx += 6
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
        dists = [math.sqrt((p[0]-cx)**2 + (p[1]-cy)**2) for p in pts]
        avg_r = sum(dists) / len(dists)
        if avg_r > 0.3:
            max_dev = max(abs(d - avg_r) for d in dists)
            if max_dev / avg_r < 0.15:
                return (R(cx), R(cy), R(avg_r))
    return None


# ── Text label extraction from PDF ─────────────────────────────────────────

def correct_char(c, font):
    """Apply font-specific character corrections."""
    needs_correction = any(f in font for f in CORRECTION_FONTS)
    if needs_correction and c in CHAR_CORRECTIONS:
        return CHAR_CORRECTIONS[c]
    return c


def get_drawing_labels(page, clip_rect):
    """Extract text labels within a clipping rectangle from the PDF page."""
    labels = []
    blocks = page.get_text("dict")["blocks"]
    for block in blocks:
        if block["type"] != 0:
            continue
        for line in block["lines"]:
            for span in line["spans"]:
                bbox = span["bbox"]
                # Check if span center is within clip rect (with some tolerance)
                cx = (bbox[0] + bbox[2]) / 2
                cy = (bbox[1] + bbox[3]) / 2
                if (clip_rect[0] - 5 <= cx <= clip_rect[2] + 5 and
                    clip_rect[1] - 5 <= cy <= clip_rect[3] + 5):
                    text = span["text"]
                    font = span["font"]
                    size = span["size"]
                    origin = (bbox[0], bbox[3])  # baseline position

                    # Skip body text fonts (CMR, CMBX, CMTI, CMSSBX)
                    if any(font.startswith(p) for p in ("CMR", "CMBX", "CMTI", "CMSS", "CMEX")):
                        continue

                    # Correct garbled characters
                    corrected = "".join(correct_char(c, font) for c in text)
                    if not corrected.strip():
                        continue

                    # Determine style
                    is_italic = "Italic" in font or "italic" in font or "CMMI" in font or "CMMIB" in font
                    is_bold = "Bold" in font or "bold" in font or "CMBX" in font or "CMMIB" in font

                    labels.append({
                        "text": corrected,
                        "x": round(bbox[0], 1),
                        "y": round(bbox[3], 1),  # baseline
                        "size": round(size, 1),
                        "italic": is_italic,
                        "bold": is_bold,
                        "font": font,
                    })
    return labels


# ── Merge sub/superscripts into parent labels ──────────────────────────────

def merge_sub_superscripts(labels):
    """Merge small labels adjacent to a big label into tspan children.

    Detects subscripts (below baseline) and superscripts (above baseline)
    and attaches them as children with baseline-shift info.
    """
    # Sort labels left-to-right, then top-to-bottom
    labels_sorted = sorted(labels, key=lambda l: (l["x"], l["y"]))

    used = set()
    merged = []

    for i, lab in enumerate(labels_sorted):
        if i in used or lab["size"] < 10:
            continue
        # This is a "big" label — look for small neighbors to the right
        children = []
        for j, small in enumerate(labels_sorted):
            if j in used or j == i or small["size"] >= 10:
                continue
            dx = small["x"] - lab["x"]
            if dx < 0 or dx > 18:
                continue
            # Check vertical proximity (within ~8pt of big label baseline)
            dy = small["y"] - lab["y"]
            if abs(dy) > 10:
                continue
            # Determine super vs sub
            if dy < -0.5:
                shift = "super"
            else:
                shift = "sub"
            children.append((j, dx, {
                "text": small["text"],
                "size": small["size"],
                "shift": shift,
            }))
            used.add(j)

        # Sort: superscripts first, then subscripts (for correct tspan flow)
        children.sort(key=lambda c: (0 if c[2]["shift"] == "super" else 1, c[1]))
        entry = dict(lab)
        entry["children"] = [c[2] for c in children]
        merged.append(entry)
        used.add(i)

    # Any remaining small labels that weren't merged
    for i, lab in enumerate(labels_sorted):
        if i not in used:
            entry = dict(lab)
            entry["children"] = []
            merged.append(entry)

    # Sort by original order (y, then x) for stable output
    merged.sort(key=lambda l: (l["y"], l["x"]))
    return merged


# ── SVG clip-group bounding box extraction ─────────────────────────────────

def get_clip_rect_from_svg(root, group):
    """Get the bounding box of a clip-group in page coordinates."""
    cp_ref = group.get("clip-path", "")
    clip_id = cp_ref.replace("url(#", "").replace(")", "")
    cp = root.find(f".//{{{SVG_NS}}}clipPath[@id='{clip_id}']")
    if cp is None:
        return None
    path = cp.find(f"{{{SVG_NS}}}path")
    if path is None:
        return None
    mx = parse_matrix(path.get("transform", ""))
    d = path.get("d", "")
    if not mx:
        return None
    nums = [float(n) for n in re.findall(r'[-+]?\d*\.?\d+', d)]
    if len(nums) < 2:
        return None
    xs, ys = nums[0::2], nums[1::2]
    x0 = mx[4] + min(xs) * abs(mx[0])
    x1 = mx[4] + max(xs) * abs(mx[0])
    if mx[3] < 0:
        y0 = mx[5] - max(ys) * abs(mx[3])
        y1 = mx[5] - min(ys) * abs(mx[3])
    else:
        y0 = mx[5] + min(ys) * abs(mx[3])
        y1 = mx[5] + max(ys) * abs(mx[3])
    return (x0, y0, x1, y1)


# ── Main SVG processing ───────────────────────────────────────────────────

def process_svg(svg_path, out_path, doc, page_map):
    """Process one SVG: extract drawing paths + text labels from PDF."""
    ET.register_namespace("", SVG_NS)
    ET.register_namespace("xlink", XLINK_NS)

    tree = ET.parse(svg_path)
    root = tree.getroot()
    vb = root.get("viewBox", "0 0 100 100")
    vb_x, vb_y, vb_w, vb_h = [float(v) for v in vb.split()]

    # Get all clip-group bounding boxes to find the page and drawing area
    groups = [g for g in root.findall(f".//{{{SVG_NS}}}g") if g.get("clip-path")]
    clip_rects = []
    for g in groups:
        r = get_clip_rect_from_svg(root, g)
        if r:
            clip_rects.append(r)

    # Overall bounding box in page coords
    if clip_rects:
        page_x0 = min(r[0] for r in clip_rects)
        page_y0 = min(r[1] for r in clip_rects)
        page_x1 = max(r[2] for r in clip_rects)
        page_y1 = max(r[3] for r in clip_rects)
    else:
        page_x0, page_y0 = vb_x, vb_y
        page_x1, page_y1 = vb_x + vb_w, vb_y + vb_h

    # Find which PDF page this drawing is on
    svg_name = Path(svg_path).stem
    page_idx = page_map.get(svg_name)

    # ── Extract drawing elements from SVG ──
    drawing_elems = []
    hatch_groups = []  # list of (clip_path_d, [hatch_elems])
    seen = set()

    def extract_elem(elem):
        """Extract a single path element, return (type, d_transformed, css, attrs) or None."""
        tag = elem.tag.split("}")[-1]
        if tag == "use":
            return None
        if tag == "path":
            d = elem.get("d", "")
            if not d:
                return None
            # Skip glyph outline paths (no explicit fill or stroke)
            # These are text character outlines from PDF extraction.
            # Arrowheads have explicit fill="#231f20", so they pass through.
            raw_fill = elem.get("fill", "")
            raw_stroke = elem.get("stroke", "")
            if not raw_fill and not raw_stroke:
                return None
            mx = parse_matrix(elem.get("transform", ""))
            d_t = transform_path(d, mx) if mx else d
            if d_t in seen:
                return None
            seen.add(d_t)
            attrs = {}
            for a in ("fill", "fill-rule", "stroke", "stroke-width", "stroke-dasharray"):
                v = elem.get(a)
                if v:
                    if a == "stroke-width" and mx:
                        attrs[a] = str(R(float(v) * abs(mx[0]), 3))
                    elif a == "stroke-dasharray" and mx:
                        attrs[a] = ",".join(str(R(float(p)*abs(mx[0]), 1)) for p in v.split(","))
                    else:
                        attrs[a] = v
            css = classify_style(attrs)
            return ("path", d_t, css, attrs)
        return None

    def collect_elems(elem, skip_clip_groups=True):
        """Recursively collect path elements, skipping sub-groups with their own clip-path."""
        results = []
        tag = elem.tag.split("}")[-1]
        if tag == "g":
            # Skip sub-groups that have their own clip-path — they'll be processed separately
            if skip_clip_groups and elem.get("clip-path") and elem in groups:
                return results
            for child in elem:
                results.extend(collect_elems(child, skip_clip_groups=True))
        else:
            r = extract_elem(elem)
            if r:
                results.append(r)
        return results

    def get_clip_path_d(root, group):
        """Get the transformed clip-path 'd' string for a group."""
        cp_ref = group.get("clip-path", "")
        clip_id = cp_ref.replace("url(#", "").replace(")", "")
        cp = root.find(f".//{{{SVG_NS}}}clipPath[@id='{clip_id}']")
        if cp is None:
            return None
        path = cp.find(f"{{{SVG_NS}}}path")
        if path is None:
            return None
        d = path.get("d", "")
        mx = parse_matrix(path.get("transform", ""))
        return transform_path(d, mx) if mx else d

    for g in groups:
        # Collect direct children, skipping nested clip-groups
        elems = []
        for child in g:
            child_tag = child.tag.split("}")[-1]
            if child_tag == "g" and child.get("clip-path") and child in groups:
                continue  # processed separately
            elems.extend(collect_elems(child, skip_clip_groups=True))
        hatch = [e for e in elems if e[2] == "hatch"]
        non_hatch = [e for e in elems if e[2] != "hatch"]
        drawing_elems.extend(non_hatch)
        if hatch:
            clip_d = get_clip_path_d(root, g)
            hatch_groups.append((clip_d, hatch))

    # ── Get text labels from PDF ──
    labels = []
    if page_idx is not None and page_idx < doc.page_count:
        page = doc[page_idx]
        labels = get_drawing_labels(page, (page_x0, page_y0, page_x1, page_y1))

    # ── Build output SVG ──
    dx, dy = -vb_x, -vb_y

    lines = []
    lines.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {R(vb_w)} {R(vb_h)}">')
    lines.append('  <style>')
    lines.append(get_style_block())
    lines.append('  </style>')

    if hatch_groups:
        # Emit clipPath defs for hatching
        hatch_clip_ids = []
        has_defs = False
        for hi, (clip_d, _) in enumerate(hatch_groups):
            if clip_d:
                if not has_defs:
                    lines.append('  <defs>')
                    has_defs = True
                clip_id = f"hatch-clip-{hi}"
                hatch_clip_ids.append(clip_id)
                clip_d_s = shift_path(clip_d, dx, dy)
                lines.append(f'    <clipPath id="{clip_id}"><path d="{clip_d_s}" /></clipPath>')
            else:
                hatch_clip_ids.append(None)
        if has_defs:
            lines.append('  </defs>')

        lines.append('  <g id="hatching">')
        for hi, (clip_d, hatch_elems) in enumerate(hatch_groups):
            clip_id = hatch_clip_ids[hi]
            if clip_id:
                lines.append(f'    <g clip-path="url(#{clip_id})">')
            for _, d_t, css, attrs in hatch_elems:
                d_s = shift_path(d_t, dx, dy)
                da = f' stroke-dasharray="{attrs["stroke-dasharray"]}"' if "stroke-dasharray" in attrs else ''
                indent = '      ' if clip_id else '    '
                lines.append(f'{indent}<path d="{d_s}" class="{css}"{da} />')
            if clip_id:
                lines.append('    </g>')
        lines.append('  </g>')

    if drawing_elems:
        lines.append('  <g id="drawing">')
        for _, d_t, css, attrs in drawing_elems:
            d_s = shift_path(d_t, dx, dy)
            da = f' stroke-dasharray="{attrs["stroke-dasharray"]}"' if "stroke-dasharray" in attrs else ''
            rect = detect_rect(d_s)
            if rect:
                rx, ry, rw, rh = rect
                lines.append(f'    <rect x="{rx}" y="{ry}" width="{rw}" height="{rh}" class="{css}"{da} />')
                continue
            circle = detect_circle(d_s)
            if circle:
                ccx, ccy, cr = circle
                lines.append(f'    <circle cx="{ccx}" cy="{ccy}" r="{cr}" class="{css}"{da} />')
                continue
            lines.append(f'    <path d="{d_s}" class="{css}"{da} />')
        lines.append('  </g>')

    if labels:
        # Merge small labels (sub/superscripts) into their parent big label
        # using <tspan baseline-shift="super|sub">
        merged = merge_sub_superscripts(labels)

        lines.append('  <g id="labels">')
        for item in merged:
            lx = R(item["x"] - vb_x)
            ly = R(item["y"] - vb_y)
            sz = item["size"]
            style_parts = []
            if item["italic"]:
                style_parts.append("font-style:italic")
            if item["bold"]:
                style_parts.append("font-weight:bold")
            style_attr = f' style="{";".join(style_parts)}"' if style_parts else ''
            sz_attr = f' font-size="{R(sz)}"'

            # Build inner content with tspans for sub/superscripts
            main_text = item["text"].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            spans = ""
            for child in item.get("children", []):
                ct = child["text"].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                shift = child["shift"]  # "super" or "sub"
                csz = child["size"]
                spans += f'<tspan baseline-shift="{shift}" font-size="{R(csz)}">{ct}</tspan>'

            lines.append(f'    <text x="{lx}" y="{ly}" class="label"{sz_attr}{style_attr}>{main_text}{spans}</text>')
        lines.append('  </g>')

    lines.append('</svg>')
    output = "\n".join(lines) + "\n"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(output)
    return len(output)


# ── Main ───────────────────────────────────────────────────────────────────

def build_page_map(doc):
    """Map SVG filenames to PDF page indices based on Aufgabe text."""
    # This mirrors the extraction logic from the original script
    aufgabe_pages = {}
    for pi in range(doc.page_count):
        text = doc[pi].get_text()
        for m in re.finditer(r'Aufgabe\s+([A-Z]?\d*\.?\d+)', text):
            aufg = m.group(1)
            if pi not in aufgabe_pages:
                aufgabe_pages[pi] = []
            if aufg not in aufgabe_pages[pi]:
                aufgabe_pages[pi].append(aufg)

    # Build reverse map: svg_name -> page_index
    page_map = {}
    svg_dir = Path(__file__).parent / "svg"
    for svg_file in svg_dir.glob("*.svg"):
        name = svg_file.stem  # e.g. "aufgabe_3_1"
        # Parse aufgabe number from filename
        m = re.match(r'aufgabe_(\w+)_(\d+)(?:_([a-z]))?', name)
        if not m:
            # Try page-based names
            m2 = re.match(r'aufgabe_page(\d+)_(\d+)', name)
            if m2:
                page_map[name] = int(m2.group(1)) - 1
            continue
        chapter, num, sub = m.group(1), m.group(2), m.group(3)
        aufg_str = f"{chapter.upper() if chapter.isalpha() else chapter}.{num}"

        # Find which page has this Aufgabe
        for pi, aufgaben in aufgabe_pages.items():
            if aufg_str in aufgaben:
                page_map[name] = pi
                break

    return page_map


def main():
    input_dir = Path(__file__).parent / "svg"
    output_dir = Path(__file__).parent / "svg_clean"
    output_dir.mkdir(exist_ok=True)

    doc = pymupdf.open(str(PDF_PATH))
    page_map = build_page_map(doc)

    svg_files = sorted(input_dir.glob("*.svg"))
    print(f"Processing {len(svg_files)} SVGs...")

    total_in = total_out = errors = 0
    for svg_file in svg_files:
        in_size = svg_file.stat().st_size
        total_in += in_size
        out_path = output_dir / svg_file.name
        try:
            out_size = process_svg(str(svg_file), str(out_path), doc, page_map)
            total_out += out_size
            pct = (1 - out_size / in_size) * 100 if in_size > 0 else 0
            mapped = "✓" if svg_file.stem in page_map else "?"
            print(f"  {mapped} {svg_file.name}: {in_size:,} → {out_size:,} ({pct:.0f}%)")
        except Exception as e:
            errors += 1
            print(f"  ✗ {svg_file.name}: {e}")
            import traceback
            traceback.print_exc()

    doc.close()
    pct = (1 - total_out / total_in) * 100 if total_in > 0 else 0
    print(f"\nTotal: {total_in:,} → {total_out:,} ({pct:.0f}% reduction), {errors} errors")


if __name__ == "__main__":
    main()
