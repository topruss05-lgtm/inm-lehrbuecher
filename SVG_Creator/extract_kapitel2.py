#!/usr/bin/env python3
"""
Extract Kapitel 2 technical drawings from 'Aufgabensammlung DMS.pdf' as SVG files.
Uses pymupdf to analyze drawing elements, cluster them spatially, and crop+export.
"""

import pymupdf
import os
from collections import defaultdict

PDF_PATH = os.path.join(os.path.dirname(__file__), "Aufgabensammlung DMS.pdf")
OUT_DIR = os.path.join(os.path.dirname(__file__), "svg")
os.makedirs(OUT_DIR, exist_ok=True)

PADDING = 15  # points of padding around each cluster


def get_drawing_rects(page):
    """Get bounding rectangles of all drawing paths on a page."""
    drawings = page.get_drawings()
    rects = []
    for d in drawings:
        r = d["rect"]
        if r.width > 0 and r.height > 0:
            rects.append(r)
    return rects


def cluster_rects_x(rects, gap=80):
    """
    Cluster rectangles by x-position. If there's a horizontal gap > `gap` points,
    treat them as separate drawing groups (left vs right side of page).
    Returns list of lists of rects.
    """
    if not rects:
        return []

    # Sort rects by x-midpoint
    sorted_rects = sorted(rects, key=lambda r: (r.x0 + r.x1) / 2)

    clusters = [[sorted_rects[0]]]
    for r in sorted_rects[1:]:
        # Check if this rect's left edge is far from the current cluster's rightmost edge
        cluster_x1 = max(cr.x1 for cr in clusters[-1])
        cluster_x0 = min(cr.x0 for cr in clusters[-1])
        mid = (r.x0 + r.x1) / 2
        cluster_mid_max = max((cr.x0 + cr.x1) / 2 for cr in clusters[-1])

        if r.x0 - cluster_x1 > gap or mid - cluster_mid_max > gap:
            clusters.append([r])
        else:
            clusters[-1].append(r)

    return clusters


def cluster_bounds(rects, padding=PADDING):
    """Get padded bounding box of a list of Rect objects."""
    x0 = min(r.x0 for r in rects) - padding
    y0 = min(r.y0 for r in rects) - padding
    x1 = max(r.x1 for r in rects) + padding
    y1 = max(r.y1 for r in rects) + padding
    return pymupdf.Rect(x0, y0, x1, y1)


def extract_svg(page, clip_rect, output_path):
    """Extract a region of a page as SVG."""
    original_cropbox = page.cropbox
    page.set_cropbox(clip_rect)
    svg = page.get_svg_image(matrix=pymupdf.Matrix(3, 3), text_as_path=True)
    with open(output_path, "w") as f:
        f.write(svg)
    page.set_cropbox(original_cropbox)
    print(f"  -> Saved: {output_path}")
    print(f"     Clip: ({clip_rect.x0:.1f}, {clip_rect.y0:.1f}) - ({clip_rect.x1:.1f}, {clip_rect.y1:.1f})")
    print(f"     Size: {clip_rect.width:.0f} x {clip_rect.height:.0f} pt")


def analyze_page(doc, page_idx):
    """Analyze and print drawing clusters on a page."""
    page = doc[page_idx]
    rects = get_drawing_rects(page)
    print(f"\n{'='*60}")
    print(f"Page {page_idx} — {len(rects)} drawing elements")

    if not rects:
        print("  No drawings found!")
        return []

    clusters = cluster_rects_x(rects, gap=80)
    print(f"  Found {len(clusters)} spatial cluster(s):")

    results = []
    for i, cl in enumerate(clusters):
        bounds = cluster_bounds(cl)
        print(f"  Cluster {i}: {len(cl)} elements")
        print(f"    Bounds: ({bounds.x0:.1f}, {bounds.y0:.1f}) - ({bounds.x1:.1f}, {bounds.y1:.1f})")
        print(f"    Size: {bounds.width:.0f} x {bounds.height:.0f} pt")
        results.append(bounds)

    return results


def main():
    doc = pymupdf.open(PDF_PATH)
    print(f"Opened PDF: {PDF_PATH}")
    print(f"Pages: {len(doc)}")
    print(f"Page size: {doc[0].rect.width:.3f} x {doc[0].rect.height:.3f} pt")

    # ─── Analyze all target pages first ───
    page_clusters = {}
    for pg in [12, 13, 14, 15, 16]:
        page_clusters[pg] = analyze_page(doc, pg)

    print(f"\n{'='*60}")
    print("EXTRACTING SVGs")
    print(f"{'='*60}")

    # ─── Page 12: Aufgabe 2.2 — Pendulum (RIGHT side) ───
    print("\n--- Aufgabe 2.2 (Page 12, right cluster) ---")
    clusters = page_clusters[12]
    if len(clusters) >= 2:
        # Take the rightmost cluster
        clip = max(clusters, key=lambda r: r.x0)
    else:
        # Fallback: right half of page
        page = doc[12]
        rects = get_drawing_rects(page)
        right_rects = [r for r in rects if (r.x0 + r.x1) / 2 > 297]
        clip = cluster_bounds(right_rects) if right_rects else clusters[0]
    extract_svg(doc[12], clip, os.path.join(OUT_DIR, "aufgabe_2_2.svg"))

    # ─── Page 13: Aufgabe 2.4 — Elevator (RIGHT side) ───
    print("\n--- Aufgabe 2.4 (Page 13, right cluster) ---")
    clusters = page_clusters[13]
    if len(clusters) >= 2:
        clip = max(clusters, key=lambda r: r.x0)
    else:
        page = doc[13]
        rects = get_drawing_rects(page)
        right_rects = [r for r in rects if (r.x0 + r.x1) / 2 > 297]
        clip = cluster_bounds(right_rects) if right_rects else clusters[0]
    extract_svg(doc[13], clip, os.path.join(OUT_DIR, "aufgabe_2_4.svg"))

    # ─── Page 14: Aufgabe 2.5 — Two-arm robot (BOTH drawings together) ───
    print("\n--- Aufgabe 2.5 (Page 14, both drawings) ---")
    clusters = page_clusters[14]
    # Merge all drawing clusters into one clip region
    all_rects = get_drawing_rects(doc[14])
    clip = cluster_bounds(all_rects)
    extract_svg(doc[14], clip, os.path.join(OUT_DIR, "aufgabe_2_5.svg"))

    # ─── Page 15: Aufgabe 2.6 — Space pendulum (RIGHT side) ───
    print("\n--- Aufgabe 2.6 (Page 15, right cluster) ---")
    clusters = page_clusters[15]
    if len(clusters) >= 2:
        clip = max(clusters, key=lambda r: r.x0)
    else:
        page = doc[15]
        rects = get_drawing_rects(page)
        right_rects = [r for r in rects if (r.x0 + r.x1) / 2 > 297]
        clip = cluster_bounds(right_rects) if right_rects else clusters[0]
    extract_svg(doc[15], clip, os.path.join(OUT_DIR, "aufgabe_2_6.svg"))

    # ─── Page 16: Aufgabe 2.7 — Motorcycle (center/lower, large drawing) ───
    print("\n--- Aufgabe 2.7 (Page 16, main drawing area) ---")
    clusters = page_clusters[16]
    # For the motorcycle, we want the largest cluster (most drawing elements)
    # or the one that covers the most area
    if len(clusters) >= 2:
        clip = max(clusters, key=lambda r: r.width * r.height)
    else:
        all_rects = get_drawing_rects(doc[16])
        clip = cluster_bounds(all_rects)
    extract_svg(doc[16], clip, os.path.join(OUT_DIR, "aufgabe_2_7.svg"))

    doc.close()
    print(f"\nDone! SVGs saved to: {OUT_DIR}")


if __name__ == "__main__":
    main()
