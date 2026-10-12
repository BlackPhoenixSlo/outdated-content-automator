/* Loads the shipped storage.js into the test process WITHOUT modifying it.
 *
 * storage.js is a plain browser script (no module.exports), so we read its
 * source and evaluate it in a function scope where `chrome` and the timer
 * globals are injected, then return the symbols we want to exercise. This keeps
 * the published file pristine while still testing the real code path.
 */

const fs = require('fs');
const path = require('path');

const STORAGE_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'storage.js'),
  'utf8'
);

function loadStorage() {
  const factory = new Function(
    'chrome', 'console', 'setTimeout', 'clearTimeout',
    STORAGE_SRC +
      '\nreturn {' +
      ' ocaLoadSubmitted, ocaSaveSubmitted, ocaSaveSubmittedNow, ocaFlushSync, ocaMergeLinks,' +
      ' __ocaChunkUrls, __ocaWriteSyncBackup, __ocaReadSyncBackup,' +
      ' OCA_SYNC_MAX_URLS, OCA_SYNC_CHUNK_BYTES };'
  );
  return factory(global.chrome, console, setTimeout, clearTimeout);
}

module.exports = { loadStorage };
