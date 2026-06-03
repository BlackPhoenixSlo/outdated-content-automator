# Publishing checklist — Chrome Web Store

A step-by-step guide to get **Outdated Content Automator** from this repo into the
Chrome Web Store.

## 1. Pre-flight (local)

```bash
npm test        # all unit tests must pass
npm run lint:icons   # confirms every icon PNG exists at the right size
npm run build   # produces dist/outdated-content-automator-<version>.zip
```

The `dist/*.zip` is what you upload. It contains only the shipped files
(manifest, scripts, popup, icons) — no tests, docs, or personal data.

## 2. Smoke-test the packaged build

1. Unzip `dist/outdated-content-automator-1.0.0.zip` into a temp folder.
2. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select
   that folder.
3. Open the Remove Outdated Content page, run a couple of links, confirm it works
   and the toolbar icon shows correctly. This is the exact code reviewers run.

## 3. One-time setup

- Register a Chrome Web Store developer account (one-time US$5 fee) at
  <https://chrome.google.com/webstore/devconsole>.
- Host the privacy policy publicly (see `STORE_LISTING.md` → Privacy policy URL).

## 4. Create the listing

In the developer console → **New item** → upload the zip, then fill in:

- Name, summary, detailed description — copy from `STORE_LISTING.md`.
- Category: Productivity. Language: English.
- Store icon 128×128 (`icons/icon128.png`) + at least one 1280×800 screenshot.
- Privacy policy URL.
- Privacy practices: permission justifications + "no data collected" — all in
  `STORE_LISTING.md`.

## 5. Submit for review

Submit and wait. Review typically takes a few hours to a few days. If rejected,
the email names the policy section — fix and resubmit.

## 6. Releasing updates later

1. Bump `version` in **both** `manifest.json` and `package.json` (Web Store
   requires a strictly higher version per upload).
2. `npm test && npm run build`.
3. Upload the new zip to the existing item → submit.

---

## ⚠️ Things that commonly trip up review (read before submitting)

- **Single purpose / automation.** The store allows automation extensions, but
  reviewers look closely at anything that automates another company's product.
  Keep the single-purpose statement accurate and don't over-claim. There is a
  real chance Google scrutinizes or rejects an extension that automates a Google
  property at volume — this is a policy/business risk, not a code bug, and no
  amount of packaging removes it.
- **Unused permissions = rejection.** This build requests only `storage` and
  `activeTab`, both justified above. Don't add permissions you don't use.
- **Privacy policy must be a live URL**, not a file. A 404 fails review.
- **Screenshots must match the actual UI.** Use a real capture of the popup.
- **No remotely hosted code.** This extension ships all its code in the zip; keep
  it that way (don't add `<script src="https://…">`).
