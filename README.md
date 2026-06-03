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

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension manifest (MV3), permissions, content-script match. |
| `content.js` | Runs on the Outdated Content page; drives the submission flow. |
| `popup.html` / `popup.js` | The popup UI: link input, verify word, Start/Stop, status. |

## Notes

- All submissions go through your single Google account, which is rate-limited.
  Running multiple tabs in parallel mostly hits that limit faster, so one tab is
  usually the safest pace.
- Tuning: `content.js` has a `SETTLE` constant (ms) — lower it for more speed,
  raise it if Google's dialogs need more time to open on a slow connection.
