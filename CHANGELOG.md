# Changelog

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
