#!/bin/bash
# ═══════════════════════════════════════════════════════════
# inject-header.sh — Inject centralized mega menu header
# ═══════════════════════════════════════════════════════════
#
# Source this file from any gen.sh, then call:
#
#   inject_header <output_file> <version> <format>
#
# Arguments:
#   output_file  — Path to the generated HTML file
#   version      — Spec version, e.g. "2.0" or "1.7"
#   format       — Serialization format: "json", "xml", or "proto"
#
# The output file must contain the placeholder:
#   <!-- MEGA_MENU_HEADER -->
#
# This function:
#   1. Runs generate-menu.py to build mega menu HTML from releases.json
#   2. Inserts the generated content into header.html (at ${MEGA_MENU_PANELS})
#   3. Replaces version/format tokens
#   4. Injects the result at the placeholder location in the output file
# ═══════════════════════════════════════════════════════════

inject_header() {
  local output_file="$1"
  local version="$2"
  local format="$3"

  # Resolve path to the static directory (relative to this script)
  local HEADER_DIR
  HEADER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  if [ ! -f "$HEADER_DIR/header.html" ]; then
    echo "ERROR: header.html not found in $HEADER_DIR" >&2
    return 1
  fi
  if [ ! -f "$HEADER_DIR/releases.json" ]; then
    echo "ERROR: releases.json not found in $HEADER_DIR" >&2
    return 1
  fi
  if [ ! -f "$HEADER_DIR/generate-menu.py" ]; then
    echo "ERROR: generate-menu.py not found in $HEADER_DIR" >&2
    return 1
  fi

  # ── Compute display labels ──

  local formatLabel
  case "$format" in
    json)  formatLabel="JSON" ;;
    xml)   formatLabel="XML" ;;
    proto) formatLabel="Protobuf" ;;
    *)
      echo "ERROR: Unknown format '$format' (expected json, xml, or proto)" >&2
      return 1
      ;;
  esac

  # Nav label: "CycloneDX 2.0" for modern, "CycloneDX 1.7 (JSON)" for classic
  local navLabel
  if [[ "$version" == 1.* ]]; then
    navLabel="CycloneDX ${version} (${formatLabel})"
  else
    navLabel="CycloneDX ${version}"
  fi

  # ── Generate mega menu panels from releases.json ──

  local tmppanels
  tmppanels=$(mktemp)
  if ! python3 "$HEADER_DIR/generate-menu.py" "$HEADER_DIR/releases.json" > "$tmppanels"; then
    echo "ERROR: generate-menu.py failed" >&2
    rm -f "$tmppanels"
    return 1
  fi

  # ── Build the complete header: insert panels into header.html, then replace tokens ──

  local tmpheader
  tmpheader=$(mktemp)

  # First: insert generated panels at ${MEGA_MENU_PANELS} placeholder
  sed \
    -e '/\${MEGA_MENU_PANELS}/r '"$tmppanels" \
    -e '/\${MEGA_MENU_PANELS}/d' \
    "$HEADER_DIR/header.html" > "$tmpheader"

  rm -f "$tmppanels"

  # Second: replace version/format tokens
  local tmpheader2
  tmpheader2=$(mktemp)
  sed \
    -e 's|\${navLabel}|'"$navLabel"'|g' \
    -e 's|\${version}|'"$version"'|g' \
    -e 's|\${format}|'"$format"'|g' \
    -e 's|\${formatLabel}|'"$formatLabel"'|g' \
    "$tmpheader" > "$tmpheader2"

  rm -f "$tmpheader"

  # ── Inject into output file at placeholder ──

  if ! grep -q '<!-- MEGA_MENU_HEADER -->' "$output_file"; then
    echo "WARNING: Placeholder '<!-- MEGA_MENU_HEADER -->' not found in $output_file" >&2
    rm -f "$tmpheader2"
    return 1
  fi

  local tmpout
  tmpout=$(mktemp)
  sed \
    -e '/<!-- MEGA_MENU_HEADER -->/r '"$tmpheader2" \
    -e '/<!-- MEGA_MENU_HEADER -->/d' \
    "$output_file" > "$tmpout" && mv "$tmpout" "$output_file"

  rm -f "$tmpheader2"
  echo "  Injected header: v$version ($formatLabel)"
}
