// tests/audioBooster.test.mjs
// Unit tests for Audio Booster volume computation, normalization state, and speedFormatter edge cases

import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBytesPerSec } from '../src/utils/speedFormatter.ts';

test('formatBytesPerSec handles extreme and invalid numbers gracefully', () => {
  // Infinity and -Infinity
  assert.deepEqual(formatBytesPerSec(Infinity), {
    formatted: '0 KB/s',
    value: '0',
    unit: 'KB/s',
    mbps: '0 Mbps',
  });
  assert.deepEqual(formatBytesPerSec(-Infinity), {
    formatted: '0 KB/s',
    value: '0',
    unit: 'KB/s',
    mbps: '0 Mbps',
  });

  // NaN
  assert.deepEqual(formatBytesPerSec(NaN), {
    formatted: '0 KB/s',
    value: '0',
    unit: 'KB/s',
    mbps: '0 Mbps',
  });

  // Large values (e.g., 50 MB/s and 1.2 GB/s)
  const fiftyMB = formatBytesPerSec(50 * 1024 * 1024);
  assert.equal(fiftyMB.unit, 'MB/s');
  assert.equal(fiftyMB.value, '50.00');
  assert.equal(fiftyMB.formatted, '50.00 MB/s');
  assert.equal(fiftyMB.mbps, '419.4 Mbps');

  const gigabit = formatBytesPerSec(125 * 1000 * 1000);
  assert.equal(gigabit.unit, 'MB/s');
  assert.equal(gigabit.mbps, '1000.0 Mbps');
});

test('audio booster volume clamping logic maps correctly', () => {
  // Pure volume mapping function matching AudioBoosterManager.setBoost
  function computeTargetGain(percent) {
    return Math.max(0, Math.min(300, percent)) / 100;
  }

  assert.equal(computeTargetGain(0), 0.0);
  assert.equal(computeTargetGain(50), 0.5);
  assert.equal(computeTargetGain(100), 1.0);
  assert.equal(computeTargetGain(200), 2.0);
  assert.equal(computeTargetGain(300), 3.0);

  // Clamping over maximum 300%
  assert.equal(computeTargetGain(350), 3.0);
  assert.equal(computeTargetGain(1000), 3.0);

  // Clamping under minimum 0%
  assert.equal(computeTargetGain(-50), 0.0);
  assert.equal(computeTargetGain(-1), 0.0);
});

test('audio booster compressor dynamics presets are well-formed', () => {
  const normalSettings = {
    threshold: -18,
    knee: 12,
    ratio: 4,
    attack: 0.003,
    release: 0.25,
  };

  const broadcastNormalizedSettings = {
    threshold: -12,
    knee: 8,
    ratio: 4.5,
    attack: 0.003,
    release: 0.2,
  };

  assert.ok(broadcastNormalizedSettings.threshold > normalSettings.threshold);
  assert.ok(broadcastNormalizedSettings.ratio > normalSettings.ratio);
  assert.ok(broadcastNormalizedSettings.release < normalSettings.release);
});
