# Store assets

Chrome Web Store listing images.

| File | Use in the dashboard |
|------|----------------------|
| `01-hero.png` … `04-privacy.png` | **Screenshots** (1280×800). Upload 1–5; order them as numbered. |
| `../icons/icon128.png` | **Store icon** (128×128). |

## Regenerating

Screenshots render the real popup UI (same markup/CSS as `popup.html`) over a
caption, via headless Chrome:

```bash
bash store-assets/render.sh
```

`gen-screenshots.js` builds the scene HTML; `render.sh` screenshots each to a
1280×800 PNG and cleans up the intermediate HTML. Edit the `scenes` object in
`gen-screenshots.js` to change captions or the popup state shown.

> Optional promo tile (440×280) is only needed if you want the item featured.
