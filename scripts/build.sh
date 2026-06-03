#!/usr/bin/env bash
#
# build.sh — produce the Chrome Web Store upload zip.
#
# Bundles ONLY the files the extension ships with (manifest, scripts, popup,
# icons) into dist/<name>-<version>.zip. Dev-only files (tests, package.json,
# docs, personal data) are deliberately excluded.
set -euo pipefail

cd "$(dirname "$0")/.."

NAME="$(node -p "require('./package.json').name")"
VERSION="$(node -p "require('./manifest.json').version")"
OUT="dist/${NAME}-${VERSION}.zip"

# Files/dirs that are part of the shipped extension.
SHIP=(
  manifest.json
  config.js
  storage.js
  content.js
  popup.html
  popup.js
  icons
)

# Verify each shipped path exists before zipping.
for f in "${SHIP[@]}"; do
  if [[ ! -e "$f" ]]; then
    echo "ERROR: shipped path missing: $f" >&2
    exit 1
  fi
done

mkdir -p dist
rm -f "$OUT"

# -r recurse, -X strip extra Mac attrs; exclude any stray .DS_Store.
zip -r -X "$OUT" "${SHIP[@]}" -x '*.DS_Store' '*.svg' >/dev/null

echo "Built $OUT"
unzip -l "$OUT"
