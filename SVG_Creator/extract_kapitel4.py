#!/usr/bin/env python3
"""
Extract Kapitel 4 technical drawings from Aufgabensammlung DMS.pdf as SVG files.
Uses pymupdf to analyze drawing elements and extract clip regions.
"""

import pymupdf
import os

PDF_PATH = "/Users/tobias/Documents/Studium/WiSe25/INM_DB/SVG_Creator/Aufgabensammlung DMS.pdf"
OUTPUT_DIR = "/Users/tobias/Documents/Studium/WiSe25/INM_DB/SVG_Creator/svg"
PADDING = 15  # points

os.makedirs(OUTPUT_DIR, exist_ok=True)

doc = pymupdf.open(PDF_PATH)


def get_drawing_bounds(page, region=None):
    """Get bounding box of all drawings on a page, optionally filtered by region.
    region: pymupdf.Rect to filter drawings that intersect with it.
    Returns list of (x0, y0, x1, y1) tuples.
    """
    drawings = page.get_drawings()
    rects = []
    for d in drawings:
        r = d["rect"]
        if region is None or r.intersects(region):
            rects.append(r)
    return rects


def cluster_drawings_by_y(rects, gap_threshold=30):
    """Group drawing rects into vertical clusters based on y-position gaps."""
    if not rects:
        return []
    sorted_rects = sorted(rects, key=lambda r: r.y0)
    clusters = [[sorted_rects[0]]]
    for r in sorted_rects[1:]:
        # Check if this rect is close to the current cluster
        cluster_y1 = max(cr.y1 for cr in clusters[-1])
        if r.y0 - cluster_y1 > gap_threshold:
            clusters.append([r])
        else:
            clusters[-1].append(r)
    return clusters


def cluster_bounds(cluster):
    """Get bounding box of a cluster of rects."""
    x0 = min(r.x0 for r in cluster)
    y0 = min(r.y0 for r in cluster)
    x1 = max(r.x1 for r in cluster)
    y1 = max(r.y1 for r in cluster)
    return x0, y0, x1, y1


def extract_svg(page, clip_rect, output_path, scale=3):
    """Extract a region of a page as SVG."""
    original_cropbox = page.cropbox
    page.set_cropbox(clip_rect)
    svg = page.get_svg_image(matrix=pymupdf.Matrix(scale, scale), text_as_path=True)
    with open(output_path, "w") as f:
        f.write(svg)
    page.set_cropbox(original_cropbox)
    print(f"  Saved: {output_path}")
    print(f"  Clip: x0={clip_rect.x0:.1f} y0={clip_rect.y0:.1f} x1={clip_rect.x1:.1f} y1={clip_rect.y1:.1f}")


# ============================================================
# STEP 1: Analyze each page
# ============================================================

print("=" * 60)
print("ANALYSIS PHASE")
print("=" * 60)

for pg_idx in [29, 30, 33]:
    page = doc[pg_idx]
    drawings = page.get_drawings()
    print(f"\nPage {pg_idx} (PDF page {pg_idx+1}): {len(drawings)} drawing elements")
    print(f"  Page rect: {page.rect}")

    if drawings:
        rects = [d["rect"] for d in drawings]
        clusters = cluster_drawings_by_y(rects, gap_threshold=25)
        for i, cl in enumerate(clusters):
            b = cluster_bounds(cl)
            print(f"  Cluster {i}: {len(cl)} elements, bounds=({b[0]:.1f}, {b[1]:.1f}, {b[2]:.1f}, {b[3]:.1f})")


# ============================================================
# STEP 2: Extract SVGs
# ============================================================

print("\n" + "=" * 60)
print("EXTRACTION PHASE")
print("=" * 60)

# --- Aufgabe 4.1 (Page 29, 0-indexed) ---
# Right side of page: two spring configurations (parallel + series)
# From visual inspection: drawings are on the right half, upper portion
print("\n--- Aufgabe 4.1 (Page 29) ---")
page = doc[29]
drawings = page.get_drawings()
rects = [d["rect"] for d in drawings]

# Filter drawings on the right side (x > ~280) which are the spring diagrams
right_rects = [r for r in rects if r.x0 > 270]
if right_rects:
    x0 = min(r.x0 for r in right_rects) - PADDING
    y0 = min(r.y0 for r in right_rects) - PADDING
    x1 = max(r.x1 for r in right_rects) + PADDING
    y1 = max(r.y1 for r in right_rects) + PADDING
    # Limit to the Aufgabe 4.1 area (upper part, roughly y < 280 based on visual)
    upper_right = [r for r in right_rects if r.y1 < 280]
    if upper_right:
        x0 = min(r.x0 for r in upper_right) - PADDING
        y0 = min(r.y0 for r in upper_right) - PADDING
        x1 = max(r.x1 for r in upper_right) + PADDING
        y1 = max(r.y1 for r in upper_right) + PADDING
    clip = pymupdf.Rect(x0, y0, x1, y1)
    extract_svg(page, clip, os.path.join(OUTPUT_DIR, "aufgabe_4_1.svg"))
else:
    print("  WARNING: No drawings found on right side of page 29!")
    # Fallback: use approximate coordinates from visual inspection
    # Aufgabe 4.1 drawings: right half, from chapter title to ~halfway down
    clip = pymupdf.Rect(290, 100, 545, 270)
    extract_svg(page, clip, os.path.join(OUTPUT_DIR, "aufgabe_4_1.svg"))


# --- Aufgabe 4.2 (Page 29, 0-indexed) ---
# Lower area: mass-spring-force system + two Kennlinien diagrams
print("\n--- Aufgabe 4.2 (Page 29) ---")
# Aufgabe 4.2 starts around y~290 and includes main diagram + two small plots
# Filter drawings in the lower portion
lower_rects = [r for r in rects if r.y0 > 270]
if lower_rects:
    x0 = min(r.x0 for r in lower_rects) - PADDING
    y0 = min(r.y0 for r in lower_rects) - PADDING
    x1 = max(r.x1 for r in lower_rects) + PADDING
    y1 = max(r.y1 for r in lower_rects) + PADDING
    clip = pymupdf.Rect(x0, y0, x1, y1)
    extract_svg(page, clip, os.path.join(OUTPUT_DIR, "aufgabe_4_2.svg"))
else:
    print("  WARNING: No drawings found in lower area of page 29!")
    # Fallback from visual inspection
    clip = pymupdf.Rect(240, 290, 545, 590)
    extract_svg(page, clip, os.path.join(OUTPUT_DIR, "aufgabe_4_2.svg"))


# --- Aufgabe 4.3 (Page 30, 0-indexed) ---
# Two gear drawings side by side in the lower portion of the page
print("\n--- Aufgabe 4.3 (Page 30) ---")
page = doc[30]
drawings = page.get_drawings()
rects = [d["rect"] for d in drawings]

if rects:
    # The gear drawings should be in the lower half of the page
    # From visual: they start around y~380 and go to about y~680
    lower_rects = [r for r in rects if r.y0 > 300]
    if lower_rects:
        x0 = min(r.x0 for r in lower_rects) - PADDING
        y0 = min(r.y0 for r in lower_rects) - PADDING
        x1 = max(r.x1 for r in lower_rects) + PADDING
        y1 = max(r.y1 for r in lower_rects) + PADDING
        clip = pymupdf.Rect(x0, y0, x1, y1)
    else:
        # All drawings are the gear pair
        x0 = min(r.x0 for r in rects) - PADDING
        y0 = min(r.y0 for r in rects) - PADDING
        x1 = max(r.x1 for r in rects) + PADDING
        y1 = max(r.y1 for r in rects) + PADDING
        clip = pymupdf.Rect(x0, y0, x1, y1)
    extract_svg(page, clip, os.path.join(OUTPUT_DIR, "aufgabe_4_3.svg"))
else:
    print("  WARNING: No drawings found on page 30!")
    # Fallback
    clip = pymupdf.Rect(50, 380, 545, 700)
    extract_svg(page, clip, os.path.join(OUTPUT_DIR, "aufgabe_4_3.svg"))


# --- Aufgabe 4.4 (Page 33, 0-indexed) ---
# Ball bearing drawing on the right side of the page
print("\n--- Aufgabe 4.4 (Page 33) ---")
page = doc[33]
drawings = page.get_drawings()
rects = [d["rect"] for d in drawings]

if rects:
    # The bearing drawing is on the right side, upper portion
    right_rects = [r for r in rects if r.x0 > 270]
    if right_rects:
        x0 = min(r.x0 for r in right_rects) - PADDING
        y0 = min(r.y0 for r in right_rects) - PADDING
        x1 = max(r.x1 for r in right_rects) + PADDING
        y1 = max(r.y1 for r in right_rects) + PADDING
        clip = pymupdf.Rect(x0, y0, x1, y1)
    else:
        # All drawings
        x0 = min(r.x0 for r in rects) - PADDING
        y0 = min(r.y0 for r in rects) - PADDING
        x1 = max(r.x1 for r in rects) + PADDING
        y1 = max(r.y1 for r in rects) + PADDING
        clip = pymupdf.Rect(x0, y0, x1, y1)
    extract_svg(page, clip, os.path.join(OUTPUT_DIR, "aufgabe_4_4.svg"))
else:
    print("  WARNING: No drawings found on page 33!")
    # Fallback from visual inspection
    clip = pymupdf.Rect(300, 50, 545, 360)
    extract_svg(page, clip, os.path.join(OUTPUT_DIR, "aufgabe_4_4.svg"))


doc.close()
print("\nDone! All SVGs saved to:", OUTPUT_DIR)
