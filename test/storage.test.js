const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resetChrome } = require('./chrome-mock');
const { loadStorage } = require('./load');

test('save then load round-trips the skip list via local storage', async () => {
  const { local } = resetChrome();
  const s = loadStorage();

  const urls = ['https://a.com/1.jpg', 'https://b.com/2.jpg'];
  await s.ocaSaveSubmittedNow(urls);

  assert.deepEqual(local.__store.submittedUrls, urls);
  assert.deepEqual(await s.ocaLoadSubmitted(), urls);
});

test('load restores from the sync backup when local was wiped', async () => {
  const { local } = resetChrome();
  const s = loadStorage();

  // Seed sync only (simulates an extension reload that cleared local).
  await s.ocaSaveSubmittedNow(['https://x.com/keep.jpg']);
  delete local.__store.submittedUrls;
  assert.equal(local.__store.submittedUrls, undefined);

  const restored = await s.ocaLoadSubmitted();
  assert.deepEqual(restored, ['https://x.com/keep.jpg']);
  // ...and it should have re-hydrated local for the next read.
  assert.deepEqual(local.__store.submittedUrls, ['https://x.com/keep.jpg']);
});

test('load returns [] when nothing has been saved', async () => {
  resetChrome();
  const s = loadStorage();
  assert.deepEqual(await s.ocaLoadSubmitted(), []);
});

test('chunking keeps every chunk under the per-item byte cap and loses no URLs', async () => {
  resetChrome();
  const s = loadStorage();

  const urls = Array.from({ length: 1500 }, (_, i) => `https://example.com/image-${i}.jpg`);
  const chunks = s.__ocaChunkUrls(urls);

  assert.ok(chunks.length > 1, 'large list should split into multiple chunks');
  for (const c of chunks) {
    const bytes = JSON.stringify(c).length;
    assert.ok(bytes <= s.OCA_SYNC_CHUNK_BYTES, `chunk of ${bytes} bytes exceeds cap`);
  }
  assert.deepEqual(chunks.flat(), urls, 'reassembled chunks must equal the input');
});

test('sync backup keeps only the most recent OCA_SYNC_MAX_URLS entries', async () => {
  resetChrome();
  const s = loadStorage();

  const n = s.OCA_SYNC_MAX_URLS + 500;
  const urls = Array.from({ length: n }, (_, i) => `https://e.com/${i}.jpg`);
  await s.__ocaWriteSyncBackup(urls);

  const backed = await s.__ocaReadSyncBackup();
  assert.equal(backed.length, s.OCA_SYNC_MAX_URLS);
  // It should keep the tail (most recent), not the head.
  assert.equal(backed[backed.length - 1], urls[urls.length - 1]);
  assert.equal(backed[0], urls[urls.length - s.OCA_SYNC_MAX_URLS]);
});

test('shrinking the list removes stale leftover sync chunks', async () => {
  const { sync } = resetChrome();
  const s = loadStorage();

  await s.__ocaWriteSyncBackup(Array.from({ length: 800 }, (_, i) => `https://e.com/${i}.jpg`));
  const wideChunkCount = sync.__store.submittedChunkCount;
  assert.ok(wideChunkCount >= 1);

  await s.__ocaWriteSyncBackup(['https://e.com/only.jpg']);
  assert.equal(sync.__store.submittedChunkCount, 1);
  // No orphaned high-index chunks should remain.
  for (let i = 1; i < wideChunkCount; i++) {
    assert.equal(sync.__store['submittedChunk_' + i], undefined);
  }
  assert.deepEqual(await s.__ocaReadSyncBackup(), ['https://e.com/only.jpg']);
});

test('dropping the list (empty array) clears both local and sync', async () => {
  const { local, sync } = resetChrome();
  const s = loadStorage();

  await s.ocaSaveSubmittedNow(['https://e.com/a.jpg', 'https://e.com/b.jpg']);
  await s.ocaSaveSubmittedNow([]); // "Drop saved"

  assert.deepEqual(local.__store.submittedUrls, []);
  assert.equal(sync.__store.submittedChunkCount, 0);
  assert.deepEqual(await s.ocaLoadSubmitted(), []);
});
