const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));

test('is a Manifest V3 extension with the required top-level fields', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.ok(manifest.name && manifest.name.length <= 75, 'name within store limit');
  assert.ok(/^\d+(\.\d+){0,3}$/.test(manifest.version), 'version is dotted integers');
  assert.ok(manifest.description && manifest.description.length <= 132,
    'description within the 132-char store limit');
});

test('declares all four icon sizes and the files exist', () => {
  for (const size of ['16', '32', '48', '128']) {
    const rel = manifest.icons && manifest.icons[size];
    assert.ok(rel, `icons["${size}"] is declared`);
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `${rel} exists on disk`);
  }
});

test('the popup and its referenced scripts exist', () => {
  assert.ok(fs.existsSync(path.join(ROOT, manifest.action.default_popup)));
});

test('content-script files exist and load config before content', () => {
  const cs = manifest.content_scripts[0];
  for (const js of cs.js) {
    assert.ok(fs.existsSync(path.join(ROOT, js)), `${js} exists`);
  }
  // config.js defines OCA_TIMINGS that content.js reads at top level, and
  // storage.js defines the oca* helpers — both must load first.
  assert.ok(cs.js.indexOf('config.js') < cs.js.indexOf('content.js'));
  assert.ok(cs.js.indexOf('storage.js') < cs.js.indexOf('content.js'));
});

test('only requests permissions the code actually uses', () => {
  const allowed = new Set(['storage', 'activeTab']);
  for (const p of manifest.permissions || []) {
    assert.ok(allowed.has(p), `unexpected/unused permission requested: ${p}`);
  }
});
