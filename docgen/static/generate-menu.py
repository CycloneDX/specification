#!/usr/bin/env python3
"""
generate-menu.py — Generate mega menu HTML from releases.json

Usage:
    python3 generate-menu.py <releases.json>

Reads the releases data and outputs the mega menu inner HTML
(sidebar + content panels) to stdout.

Each release can have:
    "featured": true   — renders as a featured card (gradient, description)
    "skip": true       — excluded from output

Groups can also have:
    "skip": true       — entire group excluded
    "note": "..."      — footnote shown below all releases in the panel
"""

import json
import os
import sys
import html

# This script's directory is the only allowed location for input files
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def validate_input_path(path):
    """Ensure the input file resolves to within the script's directory."""
    # Resolve symlinks and remove any ".." components to get a canonical path
    resolved = os.path.realpath(path)
    try:
        common = os.path.commonpath([resolved, SCRIPT_DIR])
    except ValueError:
        common = None
    # Require the resolved path to be strictly inside SCRIPT_DIR (not equal to it)
    if common != SCRIPT_DIR or resolved == SCRIPT_DIR:
        print(f"ERROR: Input file must reside in {SCRIPT_DIR}", file=sys.stderr)
        sys.exit(1)
    return resolved


def fmt_label(fmt):
    """Format code to display label."""
    return {"json": "JSON", "xml": "XML", "proto": "Proto"}.get(fmt, fmt.upper())


def render_sidebar(groups):
    lines = ['<div class="mega-sidebar">']
    for group in groups:
        lines.append(f'<div class="mega-section-label">{group["section"]}</div>')
        lines.append(f'<a class="mega-sidebar-item" data-mega-target="{group["id"]}">')
        lines.append(f'<span class="sidebar-label">{html.escape(group["label"])}</span>')
        lines.append(f'<span class="sidebar-desc">{group["desc"]}</span>')
        lines.append('</a>')
    lines.append('</div>')
    return "\n".join(lines)


def render_featured_release(rel):
    """Render a single release as a featured card."""
    lines = []
    formats = rel.get("formats", [])
    lines.append('<div class="featured-card">')
    lines.append('<div class="fc-left">')
    lines.append(f'<div class="fc-version">v{rel["version"]}</div>')
    lines.append(f'<div class="fc-date">{html.escape(rel["date"])}</div>')
    if "ecma" in rel:
        lines.append(f'<div class="fc-ecma">{html.escape(rel["ecma"])}</div>')
    lines.append('</div>')
    if "description" in rel:
        lines.append('<div class="fc-middle">')
        lines.append(f'<div class="fc-desc">{html.escape(rel["description"])}</div>')
        lines.append('</div>')
    if formats:
        lines.append('<div class="fc-right">')
        for fmt in formats:
            fmt_href = f"/docs/{rel['version']}/{fmt}/"
            lines.append(f'<a class="fc-fmt" href="{fmt_href}">{fmt_label(fmt)}</a>')
        lines.append('</div>')
    lines.append('</div>')
    return "\n".join(lines)


def render_card_release(rel):
    """Render a single release as a standard version card."""
    lines = []
    formats = rel.get("formats", [])
    lines.append('<div class="version-card">')
    lines.append(f'<div class="vc-version">v{rel["version"]}</div>')
    lines.append(f'<div class="vc-date">{html.escape(rel["date"])}</div>')
    if "ecma" in rel:
        lines.append(f'<div class="vc-ecma">{html.escape(rel["ecma"])}</div>')
    else:
        lines.append('<div class="vc-ecma-spacer"></div>')
    if formats:
        lines.append('<div class="vc-formats">')
        for i, fmt in enumerate(formats):
            fmt_href = f"/docs/{rel['version']}/{fmt}/"
            cls = "vc-fmt vc-fmt-default" if i == 0 else "vc-fmt"
            lines.append(f'<a class="{cls}" href="{fmt_href}">{fmt_label(fmt)}</a>')
        lines.append('</div>')
    lines.append('</div>')
    return "\n".join(lines)


def render_panel(group):
    """Render a panel with a mix of featured and standard cards."""
    lines = [f'<div class="mega-panel" id="{group["id"]}">']

    featured = [r for r in group["releases"] if r.get("featured")]
    cards = [r for r in group["releases"] if not r.get("featured")]

    for rel in featured:
        lines.append(render_featured_release(rel))

    if cards:
        lines.append('<div class="version-cards">')
        for rel in cards:
            lines.append(render_card_release(rel))
        lines.append('</div>')

    if "note" in group:
        note = html.escape(group["note"])
        lines.append(f'<p class="tel-note"><i class="bi bi-info-circle"></i>{note}</p>')

    lines.append('</div>')
    return "\n".join(lines)


def main():
    if len(sys.argv) != 2:
        print("Usage: generate-menu.py <releases.json>", file=sys.stderr)
        sys.exit(1)

    input_path = validate_input_path(sys.argv[1])
    with open(input_path, "r") as f:
        data = json.load(f)

    groups = [g for g in data["groups"] if not g.get("skip")]
    for group in groups:
        group["releases"] = [r for r in group["releases"] if not r.get("skip")]
    sidebar_html = render_sidebar(groups)

    panels = []
    for group in groups:
        panels.append(render_panel(group))

    content_html = "\n".join([
        '<div class="mega-content">',
        "\n".join(panels),
        '</div>'
    ])

    print(sidebar_html)
    print(content_html)


if __name__ == "__main__":
    main()
