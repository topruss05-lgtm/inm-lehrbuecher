#!/usr/bin/env python3
"""
Extract technical drawings from Kapitel 1 (Variationsrechnung) of
'Aufgabensammlung DMS.pdf' as individual SVG files.

Uses pymupdf to analyze drawing elements and extract clip regions.
"""

import pymupdf
import os
from dataclasses import dataclass

PDF_PATH = os.path.join(os.path.dirname(__file__), "Aufgabensammlung DMS.pdf")
SVG_DIR = os.path.join(os.path.dirname(__file__), "svg")
SCALE = pymupdf.Matrix(3, 3)
PADDING = 15  # points of padding around drawing clusters


@dataclass
class ExtractionTask:
    page_idx: int       # 0-indexed page number
    filename: str       # output SVG filename (without .svg)
    description: str    # human-readable description
    # If clip is provided, use it directly; otherwise auto-detect
    clip: tuple | None = None  # (x0, y0, x1, y1) or None for auto


def find_drawing_clusters(page, gap=40):
    """Find clusters of drawing elements grouped by vertical proximity."""
    drawings = page.get_drawings()
    if not drawings:
        return []

    rects = [(d["rect"].x0, d["rect"].y0, d["rect"].x1, d["rect"].y1) for d in drawings]
    # Sort by center Y
    rects.sort(key=lambda r: (r[1] + r[3]) / 2)

    clusters = []
    current = [rects[0]]

    for r in rects[1:]:
        cur_max_y = max(c[3] for c in current)
        if r[1] <= cur_max_y + gap:
            current.append(r)
        else:
            clusters.append(current)
            current = [r]
    clusters.append(current)

    # Convert clusters to bounding boxes
    bboxes = []
    for cluster in clusters:
        x0 = min(r[0] for r in cluster)
        y0 = min(r[1] for r in cluster)
        x1 = max(r[2] for r in cluster)
        y1 = max(r[3] for r in cluster)
        bboxes.append((x0, y0, x1, y1, len(cluster)))
    return bboxes


def extract_svg(doc, page_idx, clip_rect, filename):
    """Extract SVG from a page region using cropbox method."""
    page = doc[page_idx]
    original_cropbox = page.cropbox

    clip = pymupdf.Rect(*clip_rect)
    page.set_cropbox(clip)
    svg = page.get_svg_image(matrix=SCALE, text_as_path=True)
    page.set_cropbox(original_cropbox)

    filepath = os.path.join(SVG_DIR, f"{filename}.svg")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(svg)
    print(f"  -> Saved {filepath}")


def analyze_and_extract():
    """Main extraction routine: analyze pages then extract."""
    doc = pymupdf.open(PDF_PATH)
    os.makedirs(SVG_DIR, exist_ok=True)

    print(f"PDF: {PDF_PATH}")
    print(f"Total pages: {len(doc)}")
    print(f"Output dir: {SVG_DIR}")
    print()

    # =========================================================================
    # Step 1: Analyze all relevant pages
    # =========================================================================
    pages_to_analyze = [2, 3, 4, 5, 6, 7, 8, 9]

    page_clusters = {}
    for pi in pages_to_analyze:
        page = doc[pi]
        clusters = find_drawing_clusters(page)
        page_clusters[pi] = clusters
        print(f"Page {pi} (PDF {pi+1}): {len(clusters)} cluster(s)")
        for i, (x0, y0, x1, y1, n) in enumerate(clusters):
            print(f"  Cluster {i}: ({x0:.1f}, {y0:.1f})-({x1:.1f}, {y1:.1f})  [{n} elements, {x1-x0:.0f}x{y1-y0:.0f}pt]")
        print()

    # =========================================================================
    # Step 2: Define extractions based on analysis + user hints
    # =========================================================================
    # We'll use the cluster analysis to refine these.
    # The user gave approximate locations; we match them to clusters.

    extractions = []

    # --- Page 2: Aufgabe 1.2 - Brachistochrone (upper right) ---
    # Known good clip from test: (330, 235, 525, 400)
    extractions.append(("aufgabe_1_2", 2, "Brachistochrone sketch"))

    # --- Page 3: Multiple drawings ---
    # Aufgabe 1.4 - upper right
    # Aufgabe 1.5a + 1.5b - two side by side, middle area
    # Aufgabe 1.6 - bottom right, small spring-damper-mass
    extractions.append(("aufgabe_1_4", 3, "Kürzeste Verbindung"))
    extractions.append(("aufgabe_1_5_a", 3, "Lichtweg c(x,y)"))
    extractions.append(("aufgabe_1_5_b", 3, "Brechungsindex n(y)=const"))
    extractions.append(("aufgabe_1_6", 3, "Gedämpfter Schwinger"))

    # --- Page 4: Two drawings ---
    # Aufgabe 1.7 - vertical beam (right side)
    # Aufgabe 1.8 - Transversality curves (right side, large)
    extractions.append(("aufgabe_1_7", 4, "Vertikaler Stab"))
    extractions.append(("aufgabe_1_8", 4, "Transversalitätsbedingung"))

    # --- Page 5: Two areas ---
    # Aufgabe 1.9 - distance to line (upper right)
    # Aufgabe 1.10a + 1.10b - Seifenhaut (lower, side by side)
    extractions.append(("aufgabe_1_9", 5, "Abstand zu Gerade"))
    extractions.append(("aufgabe_1_10_a", 5, "Seifenhaut links"))
    extractions.append(("aufgabe_1_10_b", 5, "Seifenhaut rechts"))

    # --- Page 6: Two drawings ---
    # Aufgabe 1.11 - x-t diagram (upper right)
    # Aufgabe 1.12 - Kragbalken (middle right)
    extractions.append(("aufgabe_1_11", 6, "Modifizierte Randbedingungen"))
    extractions.append(("aufgabe_1_12", 6, "Kragbalken"))

    # --- Page 7: One drawing ---
    # Aufgabe 1.13 - elastic string
    extractions.append(("aufgabe_1_13", 7, "Elastische Saite"))

    # --- Page 8: One drawing ---
    # Aufgabe 1.14 - 3D curve
    extractions.append(("aufgabe_1_14", 8, "3D Kurve P→Q"))

    # --- Page 9: One drawing ---
    # Aufgabe 1.15 - geodesic on surface
    extractions.append(("aufgabe_1_15", 9, "Geodäte auf Fläche"))

    # =========================================================================
    # Step 3: For each extraction, match to the right cluster and extract
    # =========================================================================
    # We need page-specific logic since each page has different layouts.
    # Let's do this page by page.

    print("=" * 60)
    print("EXTRACTING SVGs")
    print("=" * 60)

    # --- Page 2: Single drawing, known clip ---
    p2_clusters = page_clusters[2]
    # Find the cluster in the upper-right area (x > 300, y around 235-400)
    for c in p2_clusters:
        if c[0] > 250 and c[1] < 300:
            clip = (c[0] - PADDING, c[1] - PADDING, c[2] + PADDING, c[3] + PADDING)
            print(f"\nAufgabe 1.2: cluster ({c[0]:.0f},{c[1]:.0f})-({c[2]:.0f},{c[3]:.0f})")
            extract_svg(doc, 2, clip, "aufgabe_1_2")
            break

    # --- Page 3: Need to split into 3-4 clusters ---
    p3_clusters = page_clusters[3]
    print(f"\nPage 3 has {len(p3_clusters)} cluster(s)")

    # We need to be smarter about page 3 - let's look at spatial distribution
    # Sort clusters by Y position
    p3_sorted = sorted(p3_clusters, key=lambda c: c[1])

    if len(p3_sorted) >= 3:
        # First cluster (top) = Aufgabe 1.4
        c = p3_sorted[0]
        clip = (c[0] - PADDING, c[1] - PADDING, c[2] + PADDING, c[3] + PADDING)
        print(f"\nAufgabe 1.4: cluster ({c[0]:.0f},{c[1]:.0f})-({c[2]:.0f},{c[3]:.0f})")
        extract_svg(doc, 3, clip, "aufgabe_1_4")

        # Middle cluster(s) = Aufgabe 1.5 (may be one or two clusters side by side)
        middle_clusters = p3_sorted[1:-1] if len(p3_sorted) > 3 else [p3_sorted[1]]

        if len(middle_clusters) == 1:
            c = middle_clusters[0]
            # Check if it's wide enough to be two side-by-side drawings
            mid_x = (c[0] + c[2]) / 2
            if c[2] - c[0] > 200:  # Wide cluster - split in half
                clip_a = (c[0] - PADDING, c[1] - PADDING, mid_x, c[3] + PADDING)
                clip_b = (mid_x, c[1] - PADDING, c[2] + PADDING, c[3] + PADDING)
                print(f"\nAufgabe 1.5a: left half ({c[0]:.0f},{c[1]:.0f})-({mid_x:.0f},{c[3]:.0f})")
                extract_svg(doc, 3, clip_a, "aufgabe_1_5_a")
                print(f"\nAufgabe 1.5b: right half ({mid_x:.0f},{c[1]:.0f})-({c[2]:.0f},{c[3]:.0f})")
                extract_svg(doc, 3, clip_b, "aufgabe_1_5_b")
            else:
                clip = (c[0] - PADDING, c[1] - PADDING, c[2] + PADDING, c[3] + PADDING)
                print(f"\nAufgabe 1.5: single cluster ({c[0]:.0f},{c[1]:.0f})-({c[2]:.0f},{c[3]:.0f})")
                extract_svg(doc, 3, clip, "aufgabe_1_5")
        elif len(middle_clusters) >= 2:
            # Two separate clusters for 1.5a and 1.5b
            mc_sorted = sorted(middle_clusters, key=lambda c: c[0])  # sort by X
            c = mc_sorted[0]
            clip = (c[0] - PADDING, c[1] - PADDING, c[2] + PADDING, c[3] + PADDING)
            print(f"\nAufgabe 1.5a: ({c[0]:.0f},{c[1]:.0f})-({c[2]:.0f},{c[3]:.0f})")
            extract_svg(doc, 3, clip, "aufgabe_1_5_a")
            c = mc_sorted[1]
            clip = (c[0] - PADDING, c[1] - PADDING, c[2] + PADDING, c[3] + PADDING)
            print(f"\nAufgabe 1.5b: ({c[0]:.0f},{c[1]:.0f})-({c[2]:.0f},{c[3]:.0f})")
            extract_svg(doc, 3, clip, "aufgabe_1_5_b")

        # Last cluster = Aufgabe 1.6
        c = p3_sorted[-1]
        clip = (c[0] - PADDING, c[1] - PADDING, c[2] + PADDING, c[3] + PADDING)
        print(f"\nAufgabe 1.6: cluster ({c[0]:.0f},{c[1]:.0f})-({c[2]:.0f},{c[3]:.0f})")
        extract_svg(doc, 3, clip, "aufgabe_1_6")
    else:
        print("  WARNING: Expected >= 3 clusters on page 3, got", len(p3_sorted))
        print("  Will need manual adjustment!")
        # Fallback: extract all as one or handle specially
        for i, c in enumerate(p3_sorted):
            clip = (c[0] - PADDING, c[1] - PADDING, c[2] + PADDING, c[3] + PADDING)
            print(f"  Cluster {i}: ({c[0]:.0f},{c[1]:.0f})-({c[2]:.0f},{c[3]:.0f})")

    # --- Page 4: Two drawings ---
    p4_clusters = page_clusters[4]
    p4_sorted = sorted(p4_clusters, key=lambda c: c[1])
    print(f"\nPage 4 has {len(p4_sorted)} cluster(s)")

    if len(p4_sorted) >= 2:
        c = p4_sorted[0]
        clip = (c[0] - PADDING, c[1] - PADDING, c[2] + PADDING, c[3] + PADDING)
        print(f"\nAufgabe 1.7: ({c[0]:.0f},{c[1]:.0f})-({c[2]:.0f},{c[3]:.0f})")
        extract_svg(doc, 4, clip, "aufgabe_1_7")

        c = p4_sorted[-1]
        clip = (c[0] - PADDING, c[1] - PADDING, c[2] + PADDING, c[3] + PADDING)
        print(f"\nAufgabe 1.8: ({c[0]:.0f},{c[1]:.0f})-({c[2]:.0f},{c[3]:.0f})")
        extract_svg(doc, 4, clip, "aufgabe_1_8")
    elif len(p4_sorted) == 1:
        # Might be one big cluster - split by Y
        c = p4_sorted[0]
        mid_y = (c[1] + c[3]) / 2
        clip_top = (c[0] - PADDING, c[1] - PADDING, c[2] + PADDING, mid_y)
        clip_bot = (c[0] - PADDING, mid_y, c[2] + PADDING, c[3] + PADDING)
        print(f"\nAufgabe 1.7 (top): ({c[0]:.0f},{c[1]:.0f})-({c[2]:.0f},{mid_y:.0f})")
        extract_svg(doc, 4, clip_top, "aufgabe_1_7")
        print(f"\nAufgabe 1.8 (bot): ({c[0]:.0f},{mid_y:.0f})-({c[2]:.0f},{c[3]:.0f})")
        extract_svg(doc, 4, clip_bot, "aufgabe_1_8")

    # --- Page 5: Aufgabe 1.9 (top) + 1.10a/b (bottom, side by side) ---
    p5_clusters = page_clusters[5]
    p5_sorted = sorted(p5_clusters, key=lambda c: c[1])
    print(f"\nPage 5 has {len(p5_sorted)} cluster(s)")

    if len(p5_sorted) >= 2:
        # Top cluster = 1.9
        c = p5_sorted[0]
        clip = (c[0] - PADDING, c[1] - PADDING, c[2] + PADDING, c[3] + PADDING)
        print(f"\nAufgabe 1.9: ({c[0]:.0f},{c[1]:.0f})-({c[2]:.0f},{c[3]:.0f})")
        extract_svg(doc, 5, clip, "aufgabe_1_9")

        # Bottom cluster(s) = 1.10
        bottom_clusters = p5_sorted[1:]
        if len(bottom_clusters) >= 2:
            bc_sorted = sorted(bottom_clusters, key=lambda c: c[0])
            c = bc_sorted[0]
            clip = (c[0] - PADDING, c[1] - PADDING, c[2] + PADDING, c[3] + PADDING)
            print(f"\nAufgabe 1.10a: ({c[0]:.0f},{c[1]:.0f})-({c[2]:.0f},{c[3]:.0f})")
            extract_svg(doc, 5, clip, "aufgabe_1_10_a")
            c = bc_sorted[1]
            clip = (c[0] - PADDING, c[1] - PADDING, c[2] + PADDING, c[3] + PADDING)
            print(f"\nAufgabe 1.10b: ({c[0]:.0f},{c[1]:.0f})-({c[2]:.0f},{c[3]:.0f})")
            extract_svg(doc, 5, clip, "aufgabe_1_10_b")
        else:
            # One wide cluster - split horizontally
            c = bottom_clusters[0]
            mid_x = (c[0] + c[2]) / 2
            clip_a = (c[0] - PADDING, c[1] - PADDING, mid_x, c[3] + PADDING)
            clip_b = (mid_x, c[1] - PADDING, c[2] + PADDING, c[3] + PADDING)
            print(f"\nAufgabe 1.10a: ({c[0]:.0f},{c[1]:.0f})-({mid_x:.0f},{c[3]:.0f})")
            extract_svg(doc, 5, clip_a, "aufgabe_1_10_a")
            print(f"\nAufgabe 1.10b: ({mid_x:.0f},{c[1]:.0f})-({c[2]:.0f},{c[3]:.0f})")
            extract_svg(doc, 5, clip_b, "aufgabe_1_10_b")
    elif len(p5_sorted) == 1:
        # All in one cluster, need to split
        c = p5_sorted[0]
        mid_y = (c[1] + c[3]) / 2
        clip_top = (c[0] - PADDING, c[1] - PADDING, c[2] + PADDING, mid_y)
        print(f"\nAufgabe 1.9 (top): ({c[0]:.0f},{c[1]:.0f})-({c[2]:.0f},{mid_y:.0f})")
        extract_svg(doc, 5, clip_top, "aufgabe_1_9")
        # Bottom half split left/right
        mid_x = (c[0] + c[2]) / 2
        clip_bl = (c[0] - PADDING, mid_y, mid_x, c[3] + PADDING)
        clip_br = (mid_x, mid_y, c[2] + PADDING, c[3] + PADDING)
        print(f"\nAufgabe 1.10a: ({c[0]:.0f},{mid_y:.0f})-({mid_x:.0f},{c[3]:.0f})")
        extract_svg(doc, 5, clip_bl, "aufgabe_1_10_a")
        print(f"\nAufgabe 1.10b: ({mid_x:.0f},{mid_y:.0f})-({c[2]:.0f},{c[3]:.0f})")
        extract_svg(doc, 5, clip_br, "aufgabe_1_10_b")

    # --- Page 6: Aufgabe 1.11 (top) + 1.12 (middle) ---
    p6_clusters = page_clusters[6]
    p6_sorted = sorted(p6_clusters, key=lambda c: c[1])
    print(f"\nPage 6 has {len(p6_sorted)} cluster(s)")

    if len(p6_sorted) >= 2:
        c = p6_sorted[0]
        clip = (c[0] - PADDING, c[1] - PADDING, c[2] + PADDING, c[3] + PADDING)
        print(f"\nAufgabe 1.11: ({c[0]:.0f},{c[1]:.0f})-({c[2]:.0f},{c[3]:.0f})")
        extract_svg(doc, 6, clip, "aufgabe_1_11")

        c = p6_sorted[1]
        clip = (c[0] - PADDING, c[1] - PADDING, c[2] + PADDING, c[3] + PADDING)
        print(f"\nAufgabe 1.12: ({c[0]:.0f},{c[1]:.0f})-({c[2]:.0f},{c[3]:.0f})")
        extract_svg(doc, 6, clip, "aufgabe_1_12")
    elif len(p6_sorted) == 1:
        c = p6_sorted[0]
        mid_y = (c[1] + c[3]) / 2
        clip_top = (c[0] - PADDING, c[1] - PADDING, c[2] + PADDING, mid_y)
        clip_bot = (c[0] - PADDING, mid_y, c[2] + PADDING, c[3] + PADDING)
        print(f"\nAufgabe 1.11 (top): ({c[0]:.0f},{c[1]:.0f})-({c[2]:.0f},{mid_y:.0f})")
        extract_svg(doc, 6, clip_top, "aufgabe_1_11")
        print(f"\nAufgabe 1.12 (bot): ({c[0]:.0f},{mid_y:.0f})-({c[2]:.0f},{c[3]:.0f})")
        extract_svg(doc, 6, clip_bot, "aufgabe_1_12")

    # --- Page 7: Aufgabe 1.13 ---
    p7_clusters = page_clusters[7]
    print(f"\nPage 7 has {len(p7_clusters)} cluster(s)")
    if p7_clusters:
        # Take the most prominent cluster (most elements or largest)
        c = max(p7_clusters, key=lambda c: c[4])  # most elements
        clip = (c[0] - PADDING, c[1] - PADDING, c[2] + PADDING, c[3] + PADDING)
        print(f"\nAufgabe 1.13: ({c[0]:.0f},{c[1]:.0f})-({c[2]:.0f},{c[3]:.0f})")
        extract_svg(doc, 7, clip, "aufgabe_1_13")

    # --- Page 8: Aufgabe 1.14 ---
    p8_clusters = page_clusters[8]
    print(f"\nPage 8 has {len(p8_clusters)} cluster(s)")
    if p8_clusters:
        c = max(p8_clusters, key=lambda c: c[4])
        clip = (c[0] - PADDING, c[1] - PADDING, c[2] + PADDING, c[3] + PADDING)
        print(f"\nAufgabe 1.14: ({c[0]:.0f},{c[1]:.0f})-({c[2]:.0f},{c[3]:.0f})")
        extract_svg(doc, 8, clip, "aufgabe_1_14")

    # --- Page 9: Aufgabe 1.15 ---
    p9_clusters = page_clusters[9]
    print(f"\nPage 9 has {len(p9_clusters)} cluster(s)")
    if p9_clusters:
        c = max(p9_clusters, key=lambda c: c[4])
        clip = (c[0] - PADDING, c[1] - PADDING, c[2] + PADDING, c[3] + PADDING)
        print(f"\nAufgabe 1.15: ({c[0]:.0f},{c[1]:.0f})-({c[2]:.0f},{c[3]:.0f})")
        extract_svg(doc, 9, clip, "aufgabe_1_15")

    doc.close()
    print("\n" + "=" * 60)
    print("DONE!")
    print("=" * 60)


if __name__ == "__main__":
    analyze_and_extract()
