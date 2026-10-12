# Changelog

## Unreleased

- **Add links** button: append links to the queue, even mid-run (duplicates
  skipped). Start with an empty box resumes a pending queue.
- Popup "Feedback / report issue" link to a Google Form (`FEEDBACK_FORM_URL` in
  `config.js`).
- Fixed garbled symbols in the popup (missing `<meta charset="utf-8">`).

## 1.0.0 — 2026-06-03

First release prepared for the Chrome Web Store.

- Automates the Remove Outdated Content request flow (New request → Image tab →
  Copy link address → paste URL → Submit → Ok) for a pasted list of links.
- Persistent skip-list of submitted URLs, mirrored to Chrome sync, with
  export/import.
- Resumable progress; waits out Google's "Checking page URL" step and detects
  rate-limit errors.
- Tunable timing values in `config.js`; downloadable run log.
- Added extension icons (16/32/48/128), unit tests, and a Web Store build script.
- Dropped the unused `scripting` permission.
