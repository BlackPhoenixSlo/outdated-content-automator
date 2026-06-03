# Privacy Policy — Outdated Content Automator

_Last updated: 2026-06-03_

Outdated Content Automator ("the extension") is a tool that automates submitting
links to Google's **Remove Outdated Content** page. This policy explains exactly
what data it touches.

## What the extension stores

The extension stores the following **locally in your browser** using the Chrome
storage API:

- **The list of links you paste** and your progress through it (`currentIndex`,
  `isRunning`), so a run can resume after a stop.
- **An optional verification word** you choose to type, used for Google's
  confirmation step.
- **A skip-list of URLs you have already submitted**, so re-adding the same link
  skips it instead of submitting twice.
- **A run log** of timestamped step messages, which you can download or clear
  from the popup.

The skip-list is also mirrored into Chrome's **synced storage** (`storage.sync`)
so it survives an extension reload and follows your Chrome profile. This data is
synced by Google as part of your own Chrome sync; the extension's developer never
receives it.

## What the extension does NOT do

- It does **not** collect, transmit, or sell any personal data.
- It does **not** send your links or any other data to the developer or to any
  third-party server. There is no analytics, tracking, or telemetry.
- It does **not** read page content other than the controls it needs to click on
  the Remove Outdated Content page itself.
- It runs only on `https://search.google.com/search-console/remove-outdated-content*`.

## Data sharing

None. All data stays in your browser (and, for the skip-list, in your own Google
Chrome sync). The developer has no servers and receives nothing.

## Removing your data

Use **Drop saved** in the popup to clear the skip-list (local and synced), and
**Clear log** to clear the run log. Uninstalling the extension removes all of its
locally stored data.

## Contact

Questions: jakabasej1999@gmail.com
