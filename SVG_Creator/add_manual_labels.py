#!/usr/bin/env python3
"""Add manual text labels to SVGs where PDF text extraction failed.

These ~10 SVGs had all their labels as vector glyph paths in the PDF,
so the automatic text extraction couldn't find them. Labels are determined
by reading the PDF figures and the original SVG coordinate geometry.

Label format:
  (x, y, content, font_size, style)
  content can be:
    - simple string: "O", "φ", "m, l"
    - composite with sub/superscripts using tuples:
      [("e", None), ("I", "super"), ("x", "sub")]
"""

import re
import os

SVG_DIR = os.path.join(os.path.dirname(__file__), "svg_clean")

# Helper: coordinate system label e^X_y
def ekos(sup, sub):
    """Build composite label for e^sup_sub (Koordinatensystem)."""
    return [("e", None), (sup, "super"), (sub, "sub")]

# Helper: symbol with subscript
def ssub(sym, sub):
    return [(sym, None), (sub, "sub")]

# Helper: symbol with superscript
def ssup(sym, sup):
    return [(sym, None), (sup, "super")]


LABELS = {
    # ─── Aufgabe 3.6 — Schlittschuh (viewBox 0 0 171 139) ───
    "aufgabe_3_6": [
        (17, 72, ekos("I", "y"), 11, "bold"),
        (64, 120, ekos("I", "x"), 11, "bold"),
        (17, 122, "O", 11, "italic"),
        (77, 56, ekos("K", "y"), 11, "bold"),
        (131, 35, ekos("K", "x"), 11, "bold"),
        (118, 23, "S", 11, "italic"),
        (133, 16, ssub("m, Θ", "S"), 11, "italic"),
        (114, 65, "φ", 11, "italic"),
        (56, 96, [("r", None), ("I", "super"), ("OP", "sub")], 11, "italic"),
        (105, 78, "P", 11, "italic"),
    ],

    "aufgabe_5_9": "aufgabe_3_6",

    # ─── Aufgabe 5.8 — Stufenloses Getriebe (viewBox 0 0 232 108) ───
    "aufgabe_5_8": [
        (35, 25, ssub("M", "1"), 11, "italic"),
        (52, 25, "(t)", 9, ""),
        (60, 25, ssub("ω", "1"), 11, "italic"),
        (155, 25, ssub("ω", "2"), 11, "italic"),
        (178, 25, ssub("M", "2"), 11, "italic"),
        (195, 25, "(t)", 9, ""),
        (20, 55, ssub("Θ", "1"), 11, "italic"),
        (195, 55, ssub("Θ", "2"), 11, "italic"),
        (105, 18, "u(t)", 11, "italic"),
        (55, 90, ssub("φ", "1"), 11, "italic"),
        (155, 90, ssub("φ", "2"), 11, "italic"),
    ],

    # ─── Aufgabe 2.1 — Pendel (viewBox 0 0 177 205) ───
    "aufgabe_2_1": [
        (27, 66, "O", 11, "italic"),
        (43, 60, "φ", 11, "italic"),
        (143, 155, "B", 11, "italic"),
        (105, 119, "S", 11, "italic"),
        (155, 168, "m, l", 11, "italic"),
        (16, 100, ssub("k", "T"), 11, "italic"),
        (62, 23, ekos("I", "y"), 11, "bold"),
        (155, 67, ekos("I", "x"), 11, "bold"),
        (130, 97, ssup("e", "1"), 11, "bold"),
        (163, 192, "g", 11, "italic"),
    ],

    # ─── Aufgabe 2.4 — Aufzug (viewBox 0 0 296.7 308) ───
    "aufgabe_2_4": [
        (228, 28, "Motor", 9, ""),
        (185, 60, ssub("φ", "1"), 11, "italic"),
        (185, 128, ssub("φ", "2"), 11, "italic"),
        (185, 200, ssub("φ", "3"), 11, "italic"),
        (255, 88, ssub("i", "12"), 11, "italic"),
        (255, 165, ssub("i", "23"), 11, "italic"),
        (218, 218, "R", 11, "italic"),
        (250, 275, "m", 11, "italic"),
        (280, 258, "z", 11, "italic"),
        (290, 295, "g", 11, "italic"),
        (130, 40, "M", 11, "italic"),
        (240, 270, "Aufzug", 8, ""),
        (140, 80, ssub("Θ", "1"), 11, "italic"),
        (140, 148, ssub("Θ", "2"), 11, "italic"),
        (140, 218, ssub("Θ", "3"), 11, "italic"),
    ],

    # ─── Aufgabe 4.1 — Federn (viewBox 0 0 253.5 366.4) ───
    "aufgabe_4_1": [
        (85, 37, "q", 11, "italic"),
        (85, 107, "q", 11, "italic"),
        (145, 55, "a", 11, "italic"),
        (145, 125, "a", 11, "italic"),
    ],

    # ─── Aufgabe 4.3 — Evolventenverzahnung (viewBox 0 0 455 282) ───
    "aufgabe_4_3": [
        (52, 30, ssub("O", "1"), 11, "italic"),
        (18, 55, ssub("ω", "1"), 11, "italic"),
        (65, 182, ssub("O", "2"), 11, "italic"),
        (30, 210, ssub("ω", "2"), 11, "italic"),
        (75, 60, ssub("r", "1"), 11, "italic"),
        (95, 95, ssub("a", "1"), 11, "italic"),
        (50, 120, ssub("b", "1"), 11, "italic"),
        (90, 145, ssub("r", "2"), 11, "italic"),
        (70, 155, ssub("a", "2"), 11, "italic"),
        (95, 175, ssub("b", "2"), 11, "italic"),
        (35, 148, "Eingriffslinie", 7, ""),
        (103, 108, "A", 9, "italic"),
        (120, 130, "E", 9, "italic"),
        (85, 130, "C", 9, "italic"),
        (130, 115, "AE", 8, ""),
        (55, 16, "treibend", 8, ""),
        (35, 225, "getrieben", 8, ""),
        (305, 30, ssub("O", "1"), 11, "italic"),
        (365, 20, "treibend", 8, ""),
        (370, 55, ssub("e", "ξ"), 11, "bold"),
        (390, 35, ssub("e", "η"), 11, "bold"),
        (360, 180, ssub("O", "2"), 11, "italic"),
        (340, 225, "getrieben", 8, ""),
        (130, 95, "α", 11, "italic"),
        (410, 140, ssub("n", "1"), 11, "italic"),
        (320, 250, "β", 11, "italic"),
    ],

    # ─── Aufgabe 5.1 — Zwei Klötze (viewBox 0 0 182 293) ───
    "aufgabe_5_1": [
        (135, 10, "Freischnitt", 8, ""),
        (138, 30, "F", 11, "italic"),
        (168, 30, "H", 11, "italic"),
        (8, 82, "(i)", 9, ""),
        (30, 52, "x", 11, "italic"),
        (75, 52, "y", 11, "italic"),
        (55, 68, "a", 11, "italic"),
        (8, 158, "(ii)", 9, ""),
        (30, 130, "x", 11, "italic"),
        (75, 130, "y", 11, "italic"),
        (52, 148, "e(t)", 11, "italic"),
        (70, 150, "M", 11, "italic"),
        (8, 248, "(iii)", 9, ""),
        (30, 220, "x", 11, "italic"),
        (105, 220, "y", 11, "italic"),
        (65, 245, "a", 11, "italic"),
        (90, 245, "a", 11, "italic"),
        (143, 52, "F", 11, "italic"),
        (163, 52, "H", 11, "italic"),
    ],

    # ─── Aufgabe 5.7 — Artistenmodell (viewBox 0 0 460 188) ───
    "aufgabe_5_7": [
        (45, 175, "O", 11, "italic"),
        (25, 145, ssub("m", "1"), 11, "italic"),
        (10, 155, "r", 11, "italic"),
        (85, 110, "A", 11, "italic"),
        (60, 95, ssub("m", "2"), 11, "italic"),
        (55, 105, ssub("Θ", "S₂"), 11, "italic"),
        (120, 50, "B", 11, "italic"),
        (135, 30, ssub("m", "3"), 11, "italic"),
        (100, 30, ssub("Θ", "S₃"), 11, "italic"),
        (65, 160, "φ", 11, "italic"),
        (115, 75, "ψ", 11, "italic"),
        (10, 175, "g", 11, "italic"),
        (70, 120, ssub("S", "2"), 11, "italic"),
        (140, 15, ssub("S", "3"), 11, "italic"),
        (45, 120, ssub("l", "PA"), 11, "italic"),
        (170, 175, ssub("e", "x"), 11, "bold"),
        (50, 12, ssub("e", "y"), 11, "bold"),
        (275, 140, ssub("M", "1"), 11, "italic"),
        (275, 128, "(t)", 9, ""),
        (350, 65, ssub("M", "2"), 11, "italic"),
        (350, 53, "(t)", 9, ""),
        (280, 175, "O", 11, "italic"),
        (260, 155, ssub("e", "ξ"), 11, "bold"),
        (330, 95, ssub("S", "2"), 11, "italic"),
        (390, 25, ssub("S", "3"), 11, "italic"),
    ],

    # ─── Aufgabe 5.11 — Zweirädriger Karren (viewBox 0 0 414 339) ───
    "aufgabe_5_11": [
        (25, 285, "Rad 2", 8, ""),
        (310, 268, "Rad 1", 8, ""),
        (18, 255, ssub("m, Θ", "R"), 11, "italic"),
        (320, 240, ssub("m, Θ", "R"), 11, "italic"),
        (55, 270, "R", 11, "italic"),
        (310, 252, "R", 11, "italic"),
        (165, 225, ssub("M, Θ", "S"), 11, "italic"),
        (155, 210, "Ladefläche", 8, ""),
        (190, 242, "S", 11, "italic"),
        (10, 305, "F", 11, "italic"),
        (60, 325, "α", 11, "italic"),
        (195, 330, "β", 11, "italic"),
        (280, 330, "x", 11, "italic"),
        (200, 310, "y", 11, "italic"),
        (80, 300, "masselos", 7, ""),
        (160, 270, "P", 11, "italic"),
        (105, 295, "Q", 11, "italic"),
        (230, 195, ekos("K", "x"), 11, "bold"),
        (200, 175, ekos("K", "y"), 11, "bold"),
        (120, 260, "2b", 11, "italic"),
        (100, 248, "l", 11, "italic"),
        (210, 260, "ψ", 11, "italic"),
        (370, 320, ekos("I", "x"), 11, "bold"),
        (350, 290, ekos("I", "y"), 11, "bold"),
    ],
}


def render_label(x, y, content, size, style):
    """Render a label as SVG <text> element with optional <tspan> children."""
    cls = 'class="label"'
    font = f'font-size="{size}"'

    style_attr = ""
    if style == "italic":
        style_attr = ' style="font-style:italic"'
    elif style == "bold":
        style_attr = ' style="font-weight:bold"'

    if isinstance(content, str):
        # Simple text
        return f'    <text x="{x}" y="{y}" {cls} {font}{style_attr}>{content}</text>'
    elif isinstance(content, list):
        # Composite: list of (text, shift) tuples
        # shift is None (base), "super", or "sub"
        inner = ""
        sub_size = round(size * 0.65)
        for text, shift in content:
            if shift is None:
                inner += text
            elif shift == "super":
                inner += f'<tspan baseline-shift="super" font-size="{sub_size}">{text}</tspan>'
            elif shift == "sub":
                inner += f'<tspan baseline-shift="sub" font-size="{sub_size}">{text}</tspan>'
        return f'    <text x="{x}" y="{y}" {cls} {font}{style_attr}>{inner}</text>'


def insert_labels(svg_name, labels):
    """Insert <g id="labels"> with text elements into a clean SVG."""
    path = os.path.join(SVG_DIR, svg_name + ".svg")
    if not os.path.exists(path):
        print(f"  ! {svg_name}.svg not found")
        return False

    with open(path, "r") as f:
        content = f.read()

    # Remove existing labels group if present
    content = re.sub(r'\s*<g id="labels">.*?</g>\s*', '\n', content, flags=re.DOTALL)

    # Build labels XML
    lines = ['  <g id="labels">']
    for item in labels:
        x, y, text, size, style = item
        lines.append(render_label(x, y, text, size, style))
    lines.append('  </g>')
    label_block = '\n'.join(lines)

    # Insert before closing </svg>
    content = content.rstrip()
    if content.endswith('</svg>'):
        content = content[:-6] + label_block + '\n</svg>\n'
    else:
        print(f"  ! {svg_name}.svg: unexpected ending")
        return False

    with open(path, "w") as f:
        f.write(content)
    return True


def main():
    count = 0
    for svg_name, labels in LABELS.items():
        if isinstance(labels, str):
            labels = LABELS[labels]

        if insert_labels(svg_name, labels):
            print(f"  ✓ {svg_name}.svg: {len(labels)} labels added")
            count += 1
        else:
            print(f"  ✗ {svg_name}.svg: FAILED")

    print(f"\nDone: {count} SVGs updated with manual labels")


if __name__ == "__main__":
    main()
