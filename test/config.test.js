const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function loadTimings() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'config.js'), 'utf8');
  return new Function(src + '\nreturn OCA_TIMINGS;')();
}

test('every timing is a positive finite number', () => {
  const t = loadTimings();
  const keys = Object.keys(t);
  assert.ok(keys.length > 0, 'OCA_TIMINGS should not be empty');
  for (const k of keys) {
    assert.equal(typeof t[k], 'number', `${k} must be a number`);
    assert.ok(Number.isFinite(t[k]) && t[k] > 0, `${k} must be finite and > 0`);
  }
});

test('checking-dialog timeout is the longest wait (it gates the slow URL check)', () => {
  const t = loadTimings();
  assert.ok(t.CHECK_TIMEOUT >= t.DIALOG_COMPLETE_TIMEOUT);
  assert.ok(t.CHECK_TIMEOUT >= t.FINAL_PHASE_TIMEOUT);
});

test('poll interval is shorter than the timeouts it polls within', () => {
  const t = loadTimings();
  assert.ok(t.POLL_INTERVAL < t.FIND_TIMEOUT);
  assert.ok(t.FINAL_PHASE_LOOP <= t.FINAL_PHASE_TIMEOUT);
});
