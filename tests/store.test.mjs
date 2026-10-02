// tests/store.test.mjs
// Unit tests for client-side channel filtering, categorization, and search logic

import test from 'node:test';
import assert from 'node:assert/strict';
import { filterChannelsClient } from '../src/utils/channelFilter.ts';

const mockChannels = [
  {
    id: { 0: 'ch-1' },
    name: 'BBC World News',
    group: 'News;International',
    url: 'https://stream.example.com/bbc.m3u8',
    is_favorite: true,
  },
  {
    id: 'ch-2',
    name: 'Sky Sports Premier League',
    group: 'Sports',
    url: 'https://stream.example.com/skysports.m3u8',
    is_favorite: false,
  },
  {
    id: 'ch-3',
    name: 'Discovery Channel HD',
    group: 'Documentary;Science',
    url: 'https://stream.example.com/discovery.m3u8',
    is_favorite: false,
  },
  {
    id: 'ch-4',
    name: 'Al Jazeera English',
    group: 'News',
    url: 'https://stream.example.com/aljazeera.m3u8',
    is_favorite: true,
  },
];

test('filterChannelsClient with category "All" returns all channels', () => {
  const result = filterChannelsClient(mockChannels, 'All', '');
  assert.equal(result.length, 4);
});

test('filterChannelsClient with category "Favorites" returns only favorited channels', () => {
  const result = filterChannelsClient(mockChannels, 'Favorites', '');
  assert.equal(result.length, 2);
  assert.ok(result.every((c) => c.is_favorite));
  assert.equal(result[0].name, 'BBC World News');
  assert.equal(result[1].name, 'Al Jazeera English');
});

test('filterChannelsClient filters by category including multi-tag groups', () => {
  const news = filterChannelsClient(mockChannels, 'News', '');
  assert.equal(news.length, 2);
  assert.equal(news[0].name, 'BBC World News');
  assert.equal(news[1].name, 'Al Jazeera English');

  const sports = filterChannelsClient(mockChannels, 'Sports', '');
  assert.equal(sports.length, 1);
  assert.equal(sports[0].name, 'Sky Sports Premier League');

  const science = filterChannelsClient(mockChannels, 'Science', '');
  assert.equal(science.length, 1);
  assert.equal(science[0].name, 'Discovery Channel HD');
});

test('filterChannelsClient searches by channel name case-insensitively', () => {
  const result = filterChannelsClient(mockChannels, 'All', 'bbc');
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'BBC World News');

  const upperResult = filterChannelsClient(mockChannels, 'All', 'DISCOVERY');
  assert.equal(upperResult.length, 1);
  assert.equal(upperResult[0].name, 'Discovery Channel HD');
});

test('filterChannelsClient searches by group name case-insensitively', () => {
  const result = filterChannelsClient(mockChannels, 'All', 'international');
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'BBC World News');
});

test('filterChannelsClient handles combined category and search query', () => {
  const result = filterChannelsClient(mockChannels, 'News', 'al jazeera');
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Al Jazeera English');

  const empty = filterChannelsClient(mockChannels, 'Sports', 'bbc');
  assert.equal(empty.length, 0);
});

test('filterChannelsClient edge cases: empty input and whitespace query', () => {
  assert.deepEqual(filterChannelsClient([], 'All', ''), []);
  assert.deepEqual(filterChannelsClient([], 'Favorites', 'test'), []);

  const whitespace = filterChannelsClient(mockChannels, 'All', '   ');
  assert.equal(whitespace.length, 4);

  const nonExistent = filterChannelsClient(mockChannels, 'All', 'non-existent-channel-xyz');
  assert.equal(nonExistent.length, 0);
});

test('filterChannelsClient handles special characters and symbols safely', () => {
  const brackets = filterChannelsClient(mockChannels, 'All', 'HD (Science)');
  assert.equal(brackets.length, 0);

  const symbols = filterChannelsClient(mockChannels, 'All', '.*+?^${}()|[]\\');
  assert.equal(symbols.length, 0);
});

test('filterChannelsClient handles non-existent category gracefully', () => {
  const result = filterChannelsClient(mockChannels, 'NonExistentCategory999', '');
  assert.equal(result.length, 0);
});

test('filterChannelsClient filters region-blocked streams when hideRegionBlocked is enabled', () => {
  const mixedChannels = [
    ...mockChannels,
    {
      id: 'pluto-1',
      name: 'Pluto TV Movies',
      group: 'Movies',
      url: 'https://service-stitcher.clusters.pluto.tv/v1/stitch/embed/hls/channel.m3u8',
      provider: 'Pluto TV',
      is_favorite: false,
    },
    {
      id: 'roku-1',
      name: 'Roku Live News',
      group: 'News',
      url: 'https://therokuchannel.roku.com/stream.m3u8',
      provider: 'Roku',
      is_favorite: false,
    },
  ];

  // With hideRegionBlocked = false, all 6 channels returned
  const allResult = filterChannelsClient(mixedChannels, 'All', '', false);
  assert.equal(allResult.length, 6);

  // With hideRegionBlocked = true, geo-blocked channels (Pluto, Roku) are filtered
  const filteredResult = filterChannelsClient(mixedChannels, 'All', '', true);
  assert.equal(filteredResult.length, 4);
  assert.ok(!filteredResult.some((c) => c.provider === 'Pluto TV' || c.provider === 'Roku'));
});

