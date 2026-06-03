#!/usr/bin/env bash
# render.sh — regenerate the scene HTML and screenshot each to a 1280x800 PNG.
set -euo pipefail
cd "$(dirname "$0")"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

node gen-screenshots.js

for f in 0*.html; do
  png="${f%.html}.png"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=1 --window-size=1280,800 \
    --default-background-color=00000000 \
    --screenshot="$png" "$f" >/dev/null 2>&1
  echo "shot $png"
done

# Drop the intermediate HTML; keep only the PNGs.
rm -f 0*.html
echo "Screenshots ready in store-assets/"
