// tests/slices.test.mjs
// Unit tests for partitioned Zustand domain store slices

import test from 'node:test';
import assert from 'node:assert/strict';

import { usePlayerStore } from '../src/stores/playerStore.ts';
import { useStreamStore } from '../src/stores/streamStore.ts';
import { useUiStore } from '../src/stores/uiStore.ts';
import { useUpdateStore } from '../src/stores/updateStore.ts';

test('usePlayerStore manages volume, boost clamping, and aspect ratios', () => {
  const store = usePlayerStore;

  // Initial state check
  assert.equal(store.getState().isPlaying, false);
  assert.equal(store.getState().volume, 85);

  // Volume clamping
  store.getState().setVolume(150);
  assert.equal(store.getState().volume, 100);

  store.getState().setVolume(-20);
  assert.equal(store.getState().volume, 0);

  store.getState().setVolume(75);
  assert.equal(store.getState().volume, 75);

  // Sound boost clamping (100% to 300%)
  store.getState().setSoundBoost(50);
  assert.equal(store.getState().soundBoost, 100);

  store.getState().setSoundBoost(450);
  assert.equal(store.getState().soundBoost, 300);

  store.getState().setSoundBoost(150);
  assert.equal(store.getState().soundBoost, 150);

  // Aspect ratio cycling: 16:9 -> 4:3 -> fill -> 21:9 -> 16:9
  store.getState().setAspectRatio('16:9');
  store.getState().cycleAspectRatio();
  assert.equal(store.getState().aspectRatio, '4:3');
  store.getState().cycleAspectRatio();
  assert.equal(store.getState().aspectRatio, 'fill');
  store.getState().cycleAspectRatio();
  assert.equal(store.getState().aspectRatio, '21:9');
  store.getState().cycleAspectRatio();
  assert.equal(store.getState().aspectRatio, '16:9');
});

test('useStreamStore tracks buffer, stalls, and telemetry statistics', () => {
  const store = useStreamStore;

  store.getState().setBufferSecs(4.5);
  assert.equal(store.getState().bufferSecs, 4.5);

  store.getState().setTelemetryStats({
    streamBitrateFormatted: '1.8 MB/s',
    streamBitrateMbps: '14.4 Mbps',
    currentFps: 60,
    liveLatency: 1.2
  });

  assert.equal(store.getState().streamBitrateFormatted, '1.8 MB/s');
  assert.equal(store.getState().streamBitrateMbps, '14.4 Mbps');
  assert.equal(store.getState().currentFps, 60);
  assert.equal(store.getState().liveLatency, 1.2);

  // Mirror index
  store.getState().setMirrorIndex(0);
  store.getState().cycleMirror();
  assert.equal(store.getState().mirrorIndex, 1);

  // Dead channel tracking
  store.getState().markChannelDead('ch-bad-1');
  assert.ok(store.getState().deadChannelIds.includes('ch-bad-1'));

  // Stalls
  store.getState().resetStallCount();
  store.getState().incrementStallCount();
  store.getState().incrementStallCount();
  assert.equal(store.getState().stallCount, 2);
  store.getState().resetStallCount();
  assert.equal(store.getState().stallCount, 0);
});

test('useUiStore toggles modal and drawer visibility', () => {
  const store = useUiStore;

  assert.equal(store.getState().isChannelDrawerOpen, false);
  store.getState().openChannelDrawer();
  assert.equal(store.getState().isChannelDrawerOpen, true);
  store.getState().closeChannelDrawer();
  assert.equal(store.getState().isChannelDrawerOpen, false);

  assert.equal(store.getState().isSettingsOpen, false);
  store.getState().openSettings();
  assert.equal(store.getState().isSettingsOpen, true);
  store.getState().closeSettings();
  assert.equal(store.getState().isSettingsOpen, false);

  assert.equal(store.getState().isShortcutsOpen, false);
  store.getState().openShortcuts();
  assert.equal(store.getState().isShortcutsOpen, true);
  store.getState().closeShortcuts();
  assert.equal(store.getState().isShortcutsOpen, false);

  store.getState().showToast('Test Toast Notification');
  assert.equal(store.getState().toast?.message, 'Test Toast Notification');
  store.getState().hideToast();
  assert.equal(store.getState().toast, null);
});

test('useUpdateStore tracks updater lifecycle state', () => {
  const store = useUpdateStore;

  assert.equal(store.getState().isUpdateModalOpen, false);
  store.getState().setUpdateModalOpen(true);
  assert.equal(store.getState().isUpdateModalOpen, true);

  store.getState().dismissUpdate();
  assert.equal(store.getState().updateInfo, null);
  assert.equal(store.getState().updateStatus, 'idle');
  assert.equal(store.getState().updateProgress, 0);
});
