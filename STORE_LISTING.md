# Chrome Web Store listing — copy & paste

Everything you need to fill in the Web Store developer dashboard. Limits are
Google's; the text below already respects them.

---

## Name (≤ 75 chars)

```
Outdated Content Automator
```

## Summary / short description (≤ 132 chars)

```
Bulk-submit links to Google's Remove Outdated Content tool. Skip-list, resumable progress, and per-step timing controls.
```

## Category

`Productivity`  (alternative: `Workflow & Planning`)

## Language

English

---

## Detailed description

```
Outdated Content Automator walks Google's "Remove Outdated Content" request flow
for you, one link at a time, so you don't have to click through New request →
Image tab → Copy link address → paste URL → Submit → Ok by hand for every URL.

HOW IT WORKS
1. Open the Remove Outdated Content page in Search Console.
2. Click the extension icon, paste your links (one per line), and press
   "Start processing".
3. The extension submits each link in turn and shows live progress.

FEATURES
• Bulk submit — paste many links and walk away.
• Skip-list — every submitted URL is remembered, so re-adding a link skips it
  instead of submitting twice. Export/import the list as a file for backup.
• Resumable — progress is saved, so you can stop and pick up where you left off.
• Patient with slow dialogs — it waits out Google's "Checking page URL" step
  instead of racing it, and detects rate-limit errors so it stops cleanly.
• Tunable timing — every wait value lives in a single config file you can adjust
  for a faster or a slower, more cautious pace.
• Downloadable run log — timestamped per-step log for troubleshooting.

PRIVACY
Everything stays in your browser. No analytics, no tracking, no data sent to the
developer. The extension runs only on the Remove Outdated Content page. See the
privacy policy for details.

NOTE
Submissions go through your own Google account, which Google rate-limits. Running
one tab is the steadiest pace; the extension stops cleanly if Google returns a
"Something went wrong" rate-limit error so you can reload and resume.
```

---

## Permission justifications

Paste these into the "Privacy practices" tab when the dashboard asks why each
permission is needed.

**`storage`**
```
Saves your link list and progress so a run can resume after a stop, and keeps a
skip-list of already-submitted URLs (mirrored to Chrome sync) so the same link is
not submitted twice. All data stays in the user's browser.
```

**`activeTab`**
```
When the user clicks the toolbar icon and presses Start, the extension checks the
active tab's URL to confirm it is the Remove Outdated Content page before sending
it the "start" message. No other tabs are accessed.
```

**Host permission — `https://search.google.com/search-console/remove-outdated-content*`**
```
The content script runs only on Google's Remove Outdated Content page, where it
clicks the request-flow buttons to submit each link the user provided.
```

**Single purpose statement**
```
A single-purpose tool that automates submitting a user-provided list of links to
Google's Remove Outdated Content page.
```

**Remote code**: No — the extension contains no remotely hosted code.

---

## Data-use disclosures (Privacy practices tab)

- Does the extension collect user data? **No data is collected or transmitted.**
- The link list, verification word, skip-list, and run log are stored **locally**
  (skip-list also via Chrome sync) and never sent to the developer or any third
  party.
- Not sold, not used for ads, not used for creditworthiness or lending.

---

## Required assets (you must supply these images)

The store will not let you publish without them:

| Asset | Size | Notes |
|-------|------|-------|
| Store icon | 128×128 PNG | Use `icons/icon128.png` (already generated). |
| Screenshot(s) | 1280×800 or 640×400 PNG/JPEG | At least 1, up to 5. Show the popup over the Remove Outdated Content page. |
| Small promo tile (optional) | 440×280 PNG | Only if you want to be featured. |

Tip for the screenshot: open the Remove Outdated Content page, click the
extension, paste a couple of links, and capture the popup. Crop/scale to 1280×800.

---

## Privacy policy URL

The Web Store requires a publicly reachable URL (a file on disk is not accepted).
Host `PRIVACY.md` somewhere public — e.g. push this repo to GitHub and use the
raw/Pages URL, or paste the text into a GitHub Gist — and put that link in the
listing's "Privacy policy" field.
