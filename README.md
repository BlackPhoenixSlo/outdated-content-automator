# Outdated Content Automator

A Chrome (Manifest V3) extension that automates submitting links to Google's
[Remove Outdated Content](https://search.google.com/search-console/remove-outdated-content) tool.

You paste a list of URLs, press Start, and the extension walks the "New request"
flow for each link automatically (New request → Image tab → "Copy link address"
option → paste URL → Submit → Ok), then moves on to the next link.

## Features

- Bulk submit many links (one per line).
- Keeps running even when the tab is in the background.
- Optional verification word for the confirmation step.
- Remembers progress (`currentIndex`) so you can resume after a stop.
- Waits for each dialog element to be ready before acting (fast but stable),
  with a short settle pause to avoid clicking mid-animation.
- Detects Google's "Something went wrong" rate-limit error and stops cleanly,
  showing a message in the popup so you can reload and resume.

## Install (unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. Open the [Remove Outdated Content](https://search.google.com/search-console/remove-outdated-content)
   page, click the extension icon, paste your links, and press **Start processing**.
5. To queue more links (even mid-run), paste them and press **Add links**: they are
   appended to the current queue (duplicates skipped) and picked up after the
   current link. When idle, press **Start processing** with an empty box to run
   the remaining queue.
6. The link at the bottom of the popup opens Google's **Remove Outdated Content**
   tool in a new tab (URL is `REMOVAL_TOOL_URL` in `config.js`).

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension manifest (MV3), permissions, icons, content-script match. |
| `config.js` | All wait/timeout values (the automation's ".env"). Loads before `content.js`. |
| `storage.js` | Skip-list persistence (local + chunked Chrome-sync backup). |
| `content.js` | Runs on the Outdated Content page; drives the submission flow. |
| `popup.html` / `popup.js` | The popup UI: link input, verify word, Start/Stop, export/import, log. |
| `icons/` | Toolbar/store icons (16/32/48/128) + the `icon.svg` source. |
| `test/` | Unit tests (`node --test`) for storage, config, and manifest. |
| `scripts/` | `build.sh` (Web Store zip) and `check-icons.js` (icon validator). |

## Develop & package

```bash
npm test          # run the unit tests
npm run lint:icons # verify icon PNGs exist at the right sizes
npm run build     # produce dist/outdated-content-automator-<version>.zip
```

To publish to the Chrome Web Store, see **PUBLISHING.md** and **STORE_LISTING.md**
(listing copy + permission justifications) and **PRIVACY.md** (privacy policy).

## Notes

- All submissions go through your single Google account, which is rate-limited.
  Running multiple tabs in parallel mostly hits that limit faster, so one tab is
  usually the safest pace.
- Tuning: `content.js` has a `SETTLE` constant (ms) — lower it for more speed,
  raise it if Google's dialogs need more time to open on a slow connection.
