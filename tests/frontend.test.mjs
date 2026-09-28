// tests/frontend.test.mjs
// Automated test suite for frontend utilities, speed formatting, proxy URL construction, and types

import test from 'node:test';
import assert from 'node:assert/strict';

// Test speed formatting
import { formatBytesPerSec } from '../src/utils/speedFormatter.ts';

test('formatBytesPerSec formats speeds correctly', () => {
  // Zero / negative
  assert.deepEqual(formatBytesPerSec(0), {
    formatted: '0 KB/s',
    value: '0',
    unit: 'KB/s',
    mbps: '0 Mbps'
  });
  assert.deepEqual(formatBytesPerSec(-500), {
    formatted: '0 KB/s',
    value: '0',
    unit: 'KB/s',
    mbps: '0 Mbps'
  });

  // Byte level
  const b = formatBytesPerSec(512);
  assert.equal(b.unit, 'B/s');
  assert.equal(b.value, '512');

  // KB/s level
  const kb = formatBytesPerSec(256 * 1024);
  assert.equal(kb.unit, 'KB/s');
  assert.equal(kb.value, '256.0');
  assert.equal(kb.formatted, '256.0 KB/s');

  // MB/s level (e.g. 2.5 MB/s = 20 Mbps)
  const mb = formatBytesPerSec(2.5 * 1024 * 1024);
  assert.equal(mb.unit, 'MB/s');
  assert.equal(mb.value, '2.50');
  assert.equal(mb.formatted, '2.50 MB/s');
});

// Test channel ID conversion
import { getChannelIdString } from '../src/types/index.ts';

test('getChannelIdString handles string and object IDs', () => {
  assert.equal(getChannelIdString('channel-123'), 'channel-123');
  assert.equal(getChannelIdString({ 0: 'channel-456' }), 'channel-456');
  assert.equal(getChannelIdString(1234), '1234');
});

// Test proxy URL construction logic
import { buildProxiedUrl, buildPrewarmUrl } from '../src/utils/proxy.ts';

test('buildProxiedUrl constructs valid proxied URLs with tokens and dynamic ports', () => {
  const target = 'https://stream.example.com/live.m3u8?token=xyz';
  const token = 'session-token-123';
  const port = 18182;

  const proxied = buildProxiedUrl(target, token, port);
  assert.ok(proxied.startsWith('http://127.0.0.1:18182/stream?url='));
  assert.ok(proxied.includes(encodeURIComponent(target)));
  assert.ok(proxied.includes('token=' + encodeURIComponent(token)));

  // If already proxied, does not double-wrap
  const alreadyProxied = 'http://127.0.0.1:18182/stream?url=test';
  assert.equal(buildProxiedUrl(alreadyProxied, token, port), alreadyProxied + '&token=' + encodeURIComponent(token));

  // Empty target returns empty string
  assert.equal(buildProxiedUrl('', token, port), '');
});

test('buildPrewarmUrl constructs valid prewarm URLs', () => {
  const target = 'https://stream.example.com/neighbor.m3u8';
  const token = 'token-abc';
  const port = 18185;

  const prewarm = buildPrewarmUrl(target, token, port);
  assert.ok(prewarm.startsWith('http://127.0.0.1:18185/prewarm?url='));
  assert.ok(prewarm.includes(encodeURIComponent(target)));
  assert.ok(prewarm.includes('token=' + encodeURIComponent(token)));
});
