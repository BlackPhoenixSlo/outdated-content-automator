/* storage.js — persistence for the submitted-URL skip list.
 *
 * The skip list lives in chrome.storage.local (large quota, fast). It is ALSO
 * mirrored into chrome.storage.sync so it survives an extension reload — which
 * WIPES local storage — and follows the user's Chrome profile across machines.
 *
 * chrome.storage.sync caps each item at ~8KB, so the list is split into chunks
 * stored as submittedChunk_0, submittedChunk_1, ... plus a count key.
 *
 * Loaded BEFORE content.js (content script) and popup.js (popup). Provides:
 *   ocaLoadSubmitted()       -> string[]   (restores local from sync if empty)
 *   ocaSaveSubmitted(urls)   -> writes local now, sync backup debounced
 *   ocaSaveSubmittedNow(urls)-> writes local now, sync backup immediately
 *   ocaFlushSync()           -> force-write any pending debounced sync backup
 */

const OCA_SYNC_CHUNK_PREFIX = 'submittedChunk_';
const OCA_SYNC_CHUNK_COUNT = 'submittedChunkCount';
const OCA_SYNC_CHUNK_BYTES = 7000; // stay safely under the 8192-byte/item cap
const OCA_SYNC_MAX_URLS = 2000;    // only the most recent N URLs are backed up to sync

function __ocaChunkUrls(urls) {
    const chunks = [];
    let current = [];
    let currentBytes = 2; // account for the surrounding [] of the JSON array
    for (const url of urls) {
        const addBytes = JSON.stringify(url).length + 1; // +1 for the comma
        if (current.length && currentBytes + addBytes > OCA_SYNC_CHUNK_BYTES) {
            chunks.push(current);
            current = [];
            currentBytes = 2;
        }
        current.push(url);
        currentBytes += addBytes;
    }
    if (current.length) chunks.push(current);
    return chunks;
}

async function __ocaWriteSyncBackup(urls) {
    try {
        // Sync has a small total quota, so only back up the most recent N URLs.
        // (local keeps the full list; this is just the cross-reload safety net.)
        const recent = urls.length > OCA_SYNC_MAX_URLS ? urls.slice(-OCA_SYNC_MAX_URLS) : urls;

        // How many chunks exist now, so we can delete leftovers if the list shrank.
        const prev = await chrome.storage.sync.get(OCA_SYNC_CHUNK_COUNT);
        const prevCount = prev[OCA_SYNC_CHUNK_COUNT] || 0;

        const chunks = __ocaChunkUrls(recent);
        const toSet = { [OCA_SYNC_CHUNK_COUNT]: chunks.length };
        chunks.forEach((c, i) => { toSet[OCA_SYNC_CHUNK_PREFIX + i] = c; });
        await chrome.storage.sync.set(toSet);

        if (prevCount > chunks.length) {
            const toRemove = [];
            for (let i = chunks.length; i < prevCount; i++) toRemove.push(OCA_SYNC_CHUNK_PREFIX + i);
            await chrome.storage.sync.remove(toRemove);
        }
        return true;
    } catch (err) {
        // Quota exceeded or sync disabled — local copy is still intact.
        console.warn('[OCA] sync backup failed (kept local copy):', err && err.message);
        return false;
    }
}

async function __ocaReadSyncBackup() {
    try {
        const meta = await chrome.storage.sync.get(OCA_SYNC_CHUNK_COUNT);
        const count = meta[OCA_SYNC_CHUNK_COUNT] || 0;
        if (!count) return [];
        const keys = [];
        for (let i = 0; i < count; i++) keys.push(OCA_SYNC_CHUNK_PREFIX + i);
        const data = await chrome.storage.sync.get(keys);
        const urls = [];
        for (let i = 0; i < count; i++) {
            const c = data[OCA_SYNC_CHUNK_PREFIX + i];
            if (Array.isArray(c)) urls.push(...c);
        }
        return urls;
    } catch (err) {
        console.warn('[OCA] sync restore failed:', err && err.message);
        return [];
    }
}

// Load the skip list. If local is empty but the sync backup has data (e.g. right
// after an extension reload wiped local), restore it into local and return it.
async function ocaLoadSubmitted() {
    const { submittedUrls } = await chrome.storage.local.get('submittedUrls');
    if (submittedUrls && submittedUrls.length) return submittedUrls;

    const fromSync = await __ocaReadSyncBackup();
    if (fromSync.length) {
        await chrome.storage.local.set({ submittedUrls: fromSync });
    }
    return fromSync;
}

// Debounced sync backup — coalesces rapid writes during a run into fewer
// sync.set calls (sync has per-minute/hour write quotas; local has none).
let __ocaSyncTimer = null;
let __ocaSyncPending = null;
function __ocaScheduleSyncBackup(urls) {
    __ocaSyncPending = urls;
    if (__ocaSyncTimer) return;
    __ocaSyncTimer = setTimeout(() => {
        __ocaSyncTimer = null;
        const u = __ocaSyncPending;
        __ocaSyncPending = null;
        if (u) __ocaWriteSyncBackup(u);
    }, 3000);
}

async function ocaFlushSync() {
    if (__ocaSyncTimer) { clearTimeout(__ocaSyncTimer); __ocaSyncTimer = null; }
    if (__ocaSyncPending) {
        const u = __ocaSyncPending;
        __ocaSyncPending = null;
        await __ocaWriteSyncBackup(u);
    }
}

// Hot path (per submit): write local immediately, back up to sync debounced.
async function ocaSaveSubmitted(urls) {
    await chrome.storage.local.set({ submittedUrls: urls });
    __ocaScheduleSyncBackup(urls);
}

// Popup actions (drop/import): write local and sync immediately.
async function ocaSaveSubmittedNow(urls) {
    await chrome.storage.local.set({ submittedUrls: urls });
    await __ocaWriteSyncBackup(urls);
}
