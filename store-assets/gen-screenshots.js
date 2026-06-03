/* gen-screenshots.js — write four 1280x800 store-screenshot HTML scenes.
 *
 * Each scene renders the REAL popup markup/styling (copied from popup.html) on
 * the right, with a marketing caption on the left, so the captured PNG shows the
 * extension's actual UI. Render them with render.sh (headless Chrome).
 */
const fs = require('fs');
const path = require('path');

const OUT = __dirname;

// --- the real popup body, styled exactly like popup.html, parameterised so each
//     scene can show a different state (links pre-filled, status, saved count). ---
function popup({ links, verifyWord, status, saved, running }) {
  const startDisabled = running ? 'disabled' : '';
  return `
  <div class="popup">
    <h3>Outdated Content Automator</h3>
    <div class="hint">Paste links here, separated by newlines:</div>
    <textarea>${links}</textarea>
    <div class="hint">Optional: Word to verify outdated content</div>
    <input type="text" class="word" value="${verifyWord || ''}" placeholder="e.g. chinesegalweiwei">
    <div class="controls">
      <button class="primary" ${startDisabled}>Start processing</button>
      <button>Stop</button>
    </div>
    <div class="controls">
      <button>Drop saved</button>
      <button>Export saved</button>
      <button>Import saved</button>
    </div>
    <div class="controls">
      <button>Download log.txt</button>
      <button>Clear log</button>
    </div>
    <div class="status ${running ? 'run' : ''}">${status}</div>
    <div class="hint saved">${saved}</div>
  </div>`;
}

const STYLE = `
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    width: 1280px; height: 800px; overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: linear-gradient(135deg, #4285F4 0%, #2A65C8 60%, #1B4DA6 100%);
    display: flex; align-items: center; gap: 56px; padding: 0 80px; color: #fff;
  }
  .left { width: 560px; }
  .badge { display: inline-flex; align-items: center; gap: 12px;
    background: rgba(255,255,255,.16); padding: 10px 16px 10px 12px;
    border-radius: 999px; font-weight: 600; font-size: 17px; }
  .badge img { width: 30px; height: 30px; display: block; }
  h1 { font-size: 46px; line-height: 1.12; margin: 28px 0 18px; font-weight: 800; letter-spacing: -.5px; }
  .sub { font-size: 21px; line-height: 1.5; color: rgba(255,255,255,.92); margin: 0; }
  ul { list-style: none; padding: 0; margin: 26px 0 0; font-size: 18px; }
  li { display: flex; align-items: center; gap: 12px; margin: 12px 0; color: rgba(255,255,255,.96); }
  li .ck { width: 24px; height: 24px; flex: 0 0 24px; border-radius: 50%;
    background: #34A853; color: #fff; display: grid; place-items: center; font-size: 14px; font-weight: 700; }

  /* the popup card — exact popup.html styling, zoomed up for legibility */
  .card { background: #fff; border-radius: 16px; padding: 6px;
    box-shadow: 0 30px 70px rgba(0,0,0,.35); }
  .popup { zoom: 1.45; width: 320px; padding: 12px; color: #202124; background:#fff; border-radius: 12px; }
  .popup h3 { margin: 0 0 8px; font-size: 16px; }
  .popup .hint { font-size: 12px; color: #666; margin-bottom: 8px; }
  .popup textarea { width: 100%; height: 120px; font-family: monospace; font-size: 12px;
    padding: 8px; border: 1px solid #ccc; border-radius: 4px; resize: none; color:#202124; }
  .popup .word { width: 100%; padding: 8px; margin-bottom: 10px; border: 1px solid #ccc;
    border-radius: 4px; font-size: 13px; }
  .popup .controls { display: flex; gap: 8px; margin-top: 8px; }
  .popup button { flex: 1; padding: 8px 6px; cursor: pointer; font-size: 12px;
    border: 1px solid #ccc; border-radius: 4px; background: #f5f5f5; color:#202124; }
  .popup button.primary { background: #4285F4; color: #fff; border-color: #4285F4; font-weight: 600; }
  .popup button[disabled] { opacity: .55; }
  .popup .status { margin-top: 12px; font-weight: bold; color: #333; font-size: 13px; }
  .popup .status.run { color: #1A73E8; }
  .popup .saved { margin-top: 6px; line-height: 1.4; }
`;

function scene({ headline, sub, bullets, pop }) {
  const lis = (bullets || []).map(b => `<li><span class="ck">✓</span><span>${b}</span></li>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${STYLE}</style></head>
<body>
  <div class="left">
    <div class="badge"><img src="../icons/icon128.png" alt="">Outdated Content Automator</div>
    <h1>${headline}</h1>
    <p class="sub">${sub}</p>
    ${lis ? `<ul>${lis}</ul>` : ''}
  </div>
  <div class="card">${popup(pop)}</div>
</body></html>`;
}

const SAMPLE_LINKS =
  'https://example.com/old-photo.jpg\n' +
  'https://example.com/removed-page.html\n' +
  'https://news.example.org/2019/gone.jpg\n' +
  'https://shop.example.net/discontinued.png\n' +
  'https://example.com/cached-image.webp';

const scenes = {
  '01-hero': scene({
    headline: 'Submit links to Google’s Remove Outdated Content tool — in bulk',
    sub: 'Paste your list, press Start, and the extension walks the request flow for every link automatically.',
    bullets: ['One link per line — then walk away', 'No more clicking through the dialog by hand'],
    pop: { links: SAMPLE_LINKS, status: 'Idle.', saved: '0 URLs saved.', running: false },
  }),
  '02-skiplist': scene({
    headline: 'Never submit the same URL twice',
    sub: 'Every submitted link is remembered in a skip-list — re-adding it is skipped automatically. Export and import it as a file for backup.',
    bullets: ['Persistent skip-list, mirrored to Chrome sync', 'Export / Import to back it up yourself'],
    pop: { links: SAMPLE_LINKS, status: 'Imported 1,204 URLs (1,204 new).', saved: '1,204 URLs saved (will be skipped if re-added).', running: false },
  }),
  '03-progress': scene({
    headline: 'Resumable, and patient with slow dialogs',
    sub: 'Progress is saved so you can stop and resume. It waits out Google’s “Checking page URL” step and stops cleanly on rate-limit errors.',
    bullets: ['Picks up exactly where you left off', 'Detects “Something went wrong” and stops'],
    pop: { links: SAMPLE_LINKS, verifyWord: 'chinesegalweiwei', status: 'Running... (128 / 412)', saved: '128 URLs saved (will be skipped if re-added).', running: true },
  }),
  '04-privacy': scene({
    headline: 'Everything stays in your browser',
    sub: 'No analytics, no tracking, nothing sent to the developer. The extension runs only on the Remove Outdated Content page.',
    bullets: ['No data collection or telemetry', 'Downloadable run log for troubleshooting'],
    pop: { links: SAMPLE_LINKS, status: 'Downloaded 412 log lines.', saved: '412 URLs saved (will be skipped if re-added).', running: false },
  }),
};

for (const [name, html] of Object.entries(scenes)) {
  fs.writeFileSync(path.join(OUT, `${name}.html`), html);
  console.log('wrote', `${name}.html`);
}
