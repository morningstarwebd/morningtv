// scripts/sync_and_heal.mjs
// MorningTV Stream Sentinel & Master Aggregator
// Aggregates from all top providers, deduplicates with multi-mirror fallbacks,
// probes real packet payloads, purges dead streams, and outputs 100% verified playlists.

import dns from 'node:dns';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Force IPv4 first to avoid DNS/IPv6 timeouts on Windows
dns.setDefaultResultOrder('ipv4first');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLAYLISTS_DIR = path.resolve(__dirname, '../playlists');

if (!fs.existsSync(PLAYLISTS_DIR)) {
  fs.mkdirSync(PLAYLISTS_DIR, { recursive: true });
}

// Master Upstream Providers
const UPSTREAM_PROVIDERS = [
  // 1. Regional & High-Priority Indian & Bengali Channels
  {
    name: 'IPTV-Org India',
    url: 'https://iptv-org.github.io/iptv/countries/in.m3u',
    defaultGroup: 'India'
  },
  {
    name: 'IPTV-Org Bangladesh',
    url: 'https://iptv-org.github.io/iptv/countries/bd.m3u',
    defaultGroup: 'India'
  },
  // 2. Global Curated Master
  {
    name: 'Free-TV Global Master',
    url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8',
    defaultGroup: 'General'
  },
  // 3. IPTV-Org Global Curated Categories
  {
    name: 'IPTV-Org News',
    url: 'https://iptv-org.github.io/iptv/categories/news.m3u',
    defaultGroup: 'News'
  },
  {
    name: 'IPTV-Org Sports',
    url: 'https://iptv-org.github.io/iptv/categories/sports.m3u',
    defaultGroup: 'Sports'
  },
  {
    name: 'IPTV-Org Movies',
    url: 'https://iptv-org.github.io/iptv/categories/movies.m3u',
    defaultGroup: 'Movies'
  },
  {
    name: 'IPTV-Org Animation & Kids',
    url: 'https://iptv-org.github.io/iptv/categories/animation.m3u',
    defaultGroup: 'Kids'
  },
  {
    name: 'IPTV-Org Music',
    url: 'https://iptv-org.github.io/iptv/categories/music.m3u',
    defaultGroup: 'Music'
  },
  // 4. FAST Networks
  {
    name: 'Pluto TV Curated',
    url: 'https://raw.githubusercontent.com/BuddyChewChew/pluto/main/pluto_us.m3u',
    defaultGroup: 'Entertainment'
  }
];

// Helper to fetch text safely
async function fetchText(url, timeoutMs = 25000) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*'
      }
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    console.warn(`[Warning] Failed to fetch ${url}: ${err.message}`);
    return null;
  }
}

// Normalizes name for fuzzy multi-mirror deduplication
function normalizeChannelKey(name, tvgId) {
  if (tvgId && tvgId.trim().length > 3) {
    return tvgId.toLowerCase().split('@')[0].replace(/[^a-z0-9]/g, '');
  }
  return name
    .toLowerCase()
    .replace(/\s*\(.*?\)/g, '')
    .replace(/\b(hd|sd|fhd|4k|uhd|tv|channel)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Parse M3U content and extract channel metadata
function parseM3u(content, fallbackGroup) {
  const lines = content.split('\n');
  const list = [];
  let currMeta = null;
  let currFallbacks = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF:')) {
      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      const idMatch = line.match(/tvg-id="([^"]*)"/);
      const groupMatch = line.match(/group-title="([^"]*)"/);

      const commaIdx = line.indexOf(',');
      const name = commaIdx !== -1 ? line.slice(commaIdx + 1).trim() : 'Channel';

      let group = groupMatch ? groupMatch[1].split(';')[0].trim() : fallbackGroup;
      if (!group || group.toLowerCase() === 'undefined') group = fallbackGroup;

      currMeta = {
        name,
        logo: logoMatch ? logoMatch[1].trim() : '',
        id: idMatch ? idMatch[1].trim() : '',
        group
      };
      currFallbacks = [];
    } else if (line.startsWith('#EXTFALLBACK:')) {
      const fbUrl = line.replace('#EXTFALLBACK:', '').trim();
      if (fbUrl) currFallbacks.push(fbUrl);
    } else if (line.startsWith('http://') || line.startsWith('https://')) {
      if (currMeta) {
        list.push({
          ...currMeta,
          url: line,
          fallbacks: [...currFallbacks]
        });
        currMeta = null;
        currFallbacks = [];
      }
    }
  }

  return list;
}

// Deep packet probe for a single stream URL
async function probeSingleUrl(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(3500)
    });

    const finalUrl = res.url || url;
    if (!res.ok && res.status !== 206) {
      return { ok: false };
    }

    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    if (ctype.includes('text/html') || ctype.includes('text/xml')) {
      return { ok: false };
    }

    // Read only first chunk up to 4KB
    const reader = res.body.getReader();
    const { value: chunk } = await reader.read();
    reader.cancel();

    if (!chunk || chunk.length === 0) return { ok: false };

    const textSnippet = new TextDecoder('utf-8', { fatal: false }).decode(chunk.slice(0, 512)).toLowerCase();

    // Reject fake 200 HTML wrappers
    if (
      textSnippet.includes('<html') ||
      textSnippet.includes('<!doctype') ||
      textSnippet.includes('access denied') ||
      textSnippet.includes('error 404') ||
      textSnippet.includes('stream not found') ||
      textSnippet.includes('channel offline')
    ) {
      return { ok: false };
    }

    const isHls = textSnippet.includes('#extm3u') || textSnippet.includes('#ext-x-') || textSnippet.includes('#extinf') || textSnippet.includes('.ts') || textSnippet.includes('.m4s');
    const isTs = chunk[0] === 0x47 || (chunk.length > 188 && chunk[188] === 0x47);
    const isMedia = ctype.includes('mpegurl') || ctype.includes('video/') || ctype.includes('audio/') || ctype.includes('octet-stream');

    if (isHls || isTs || (isMedia && !textSnippet.includes('<html'))) {
      return { ok: true, activeUrl: finalUrl };
    }

    return { ok: false };
  } catch {
    return { ok: false };
  }
}

// Probes channel and heals with fallbacks if primary is dead
async function verifyAndHealChannel(channel) {
  // Test primary URL
  const primCheck = await probeSingleUrl(channel.url);
  if (primCheck.ok) {
    return {
      alive: true,
      channel: {
        ...channel,
        url: primCheck.activeUrl,
        healed: primCheck.activeUrl !== channel.url
      }
    };
  }

  // Primary failed: Waterfall through fallback mirrors
  for (const fb of channel.fallbacks) {
    if (fb && fb !== channel.url) {
      const fbCheck = await probeSingleUrl(fb);
      if (fbCheck.ok) {
        // Promoted working fallback to primary!
        return {
          alive: true,
          channel: {
            ...channel,
            url: fbCheck.activeUrl,
            fallbacks: channel.fallbacks.filter(u => u !== fb),
            healed: true
          }
        };
      }
    }
  }

  return { alive: false, channel };
}

async function run() {
  console.log(`\n===============================================================`);
  console.log(`🌅 MorningTV Sentinel: Universal Multi-Provider Aggregator`);
  console.log(`===============================================================\n`);

  const channelMap = new Map(); // key -> channel with fallbacks
  let totalRawItems = 0;

  for (const provider of UPSTREAM_PROVIDERS) {
    process.stdout.write(`📥 Fetching: ${provider.name}... `);
    const text = await fetchText(provider.url);
    if (!text) {
      console.log(`[Skipped/Offline]`);
      continue;
    }

    const items = parseM3u(text, provider.defaultGroup);
    totalRawItems += items.length;
    let newChannels = 0;
    let mergedFallbacks = 0;

    for (const item of items) {
      const key = normalizeChannelKey(item.name, item.id);
      if (!key) continue;

      if (!channelMap.has(key)) {
        channelMap.set(key, {
          name: item.name,
          id: item.id,
          logo: item.logo,
          group: item.group,
          url: item.url,
          fallbacks: item.fallbacks || []
        });
        newChannels++;
      } else {
        // Channel already exists from another provider: merge as fallback mirror!
        const existing = channelMap.get(key);
        if (existing.url !== item.url && !existing.fallbacks.includes(item.url)) {
          existing.fallbacks.push(item.url);
          mergedFallbacks++;
        }
        for (const fb of item.fallbacks) {
          if (!existing.fallbacks.includes(fb) && existing.url !== fb) {
            existing.fallbacks.push(fb);
            mergedFallbacks++;
          }
        }
        if (!existing.logo && item.logo) existing.logo = item.logo;
      }
    }

    console.log(`-> Got ${items.length.toLocaleString()} items (+${newChannels.toLocaleString()} new, +${mergedFallbacks.toLocaleString()} mirrors).`);
  }

  const uniqueCandidates = Array.from(channelMap.values());
  console.log(`\n📊 Total Raw Items Gathered:       ${totalRawItems.toLocaleString()}`);
  console.log(`🎯 Unique Deduplicated Channels:    ${uniqueCandidates.length.toLocaleString()}`);

  // Sort channels: prioritize India, Regional, News, Sports, Entertainment
  uniqueCandidates.sort((a, b) => {
    const prio = (g) => {
      const gl = (g || '').toLowerCase();
      if (gl.includes('india') || gl.includes('bangla') || gl.includes('hindi')) return 1;
      if (gl.includes('news')) return 2;
      if (gl.includes('sport')) return 3;
      if (gl.includes('movie') || gl.includes('entertain')) return 4;
      return 5;
    };
    return prio(a.group) - prio(b.group);
  });

  // Balanced candidate pool for fast verification (1,000 top channels)
  const AUDIT_LIMIT = Math.min(uniqueCandidates.length, 1200);
  const candidates = uniqueCandidates.slice(0, AUDIT_LIMIT);

  console.log(`🔍 Probing ${candidates.length.toLocaleString()} channels with 60 parallel workers (Multi-Mirror Waterfall)...\n`);

  const CONCURRENCY = 60;
  let queueIdx = 0;
  let completed = 0;
  const verifiedChannels = [];
  let deadCount = 0;
  let healedCount = 0;

  async function worker() {
    while (queueIdx < candidates.length) {
      const idx = queueIdx++;
      const res = await verifyAndHealChannel(candidates[idx]);
      completed++;

      if (res.alive) {
        verifiedChannels.push(res.channel);
        if (res.channel.healed) healedCount++;
      } else {
        deadCount++;
      }

      if (completed % 100 === 0 || completed === candidates.length) {
        process.stdout.write(`   [Auditing] ${completed}/${candidates.length} (${verifiedChannels.length} Playable, ${deadCount} Dead, ${healedCount} Healed)\r`);
      }
    }
  }

  const startTime = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n\n✅ Sentinel Audit Complete in ${elapsedSec}s!`);
  console.log(`   👉 Verified Playable:   ${verifiedChannels.length.toLocaleString()}`);
  console.log(`   👉 Dead Streams Purged: ${deadCount.toLocaleString()}`);
  console.log(`   👉 Auto-Healed Mirrors: ${healedCount.toLocaleString()}`);

  // Category distribution
  const categories = {
    India: [],
    News: [],
    Sports: [],
    Movies: [],
    Entertainment: [],
    Kids: [],
    Music: []
  };

  for (const ch of verifiedChannels) {
    const g = (ch.group || '').toLowerCase();
    const n = (ch.name || '').toLowerCase();

    if (g.includes('india') || g.includes('bangla') || g.includes('hindi') || n.includes('bangla') || n.includes('zee') || n.includes('sony') || n.includes('star')) {
      categories.India.push(ch);
    }
    if (g.includes('news') || n.includes('news') || n.includes('samachar') || n.includes('24')) {
      categories.News.push(ch);
    } else if (g.includes('sport') || n.includes('sport') || n.includes('cricket') || n.includes('football')) {
      categories.Sports.push(ch);
    } else if (g.includes('movie') || n.includes('cinema') || n.includes('movie') || n.includes('film')) {
      categories.Movies.push(ch);
    } else if (g.includes('kid') || g.includes('animat') || n.includes('cartoon') || n.includes('disney')) {
      categories.Kids.push(ch);
    } else if (g.includes('music') || n.includes('music') || n.includes('sangeet')) {
      categories.Music.push(ch);
    } else {
      categories.Entertainment.push(ch);
    }
  }

  // Format into standard M3U with fallback directives
  function formatM3u(channels) {
    let out = '#EXTM3U\n';
    for (const ch of channels) {
      out += `#EXTINF:-1 tvg-id="${ch.id}" tvg-name="${ch.name}" tvg-logo="${ch.logo}" group-title="${ch.group}",${ch.name}\n`;
      if (ch.fallbacks && ch.fallbacks.length > 0) {
        for (const fb of ch.fallbacks) {
          out += `#EXTFALLBACK: ${fb}\n`;
        }
      }
      out += `${ch.url}\n`;
    }
    return out;
  }

  console.log(`\n💾 Writing Master and Categorized Playlists...`);

  fs.writeFileSync(path.join(PLAYLISTS_DIR, 'morningtv_all.m3u'), formatM3u(verifiedChannels), 'utf-8');
  fs.writeFileSync(path.join(PLAYLISTS_DIR, 'morningtv_india.m3u'), formatM3u(categories.India), 'utf-8');
  fs.writeFileSync(path.join(PLAYLISTS_DIR, 'morningtv_news.m3u'), formatM3u(categories.News), 'utf-8');
  fs.writeFileSync(path.join(PLAYLISTS_DIR, 'morningtv_sports.m3u'), formatM3u(categories.Sports), 'utf-8');
  fs.writeFileSync(path.join(PLAYLISTS_DIR, 'morningtv_movies.m3u'), formatM3u(categories.Movies), 'utf-8');
  fs.writeFileSync(path.join(PLAYLISTS_DIR, 'morningtv_entertainment.m3u'), formatM3u(categories.Entertainment), 'utf-8');
  fs.writeFileSync(path.join(PLAYLISTS_DIR, 'morningtv_kids.m3u'), formatM3u(categories.Kids), 'utf-8');
  fs.writeFileSync(path.join(PLAYLISTS_DIR, 'morningtv_music.m3u'), formatM3u(categories.Music), 'utf-8');

  // Status telemetry JSON
  const telemetry = {
    updated_at: new Date().toISOString(),
    engine: 'MorningTV Multi-Provider Sentinel 2.0',
    total_raw_scanned: totalRawItems,
    unique_candidates: uniqueCandidates.length,
    audited_in_run: candidates.length,
    verified_playable: verifiedChannels.length,
    dead_purged: deadCount,
    mirrors_healed: healedCount,
    health_score: `${((verifiedChannels.length / candidates.length) * 100).toFixed(1)}%`,
    categories: {
      all: verifiedChannels.length,
      india: categories.India.length,
      news: categories.News.length,
      sports: categories.Sports.length,
      movies: categories.Movies.length,
      entertainment: categories.Entertainment.length,
      kids: categories.Kids.length,
      music: categories.Music.length
    }
  };

  fs.writeFileSync(path.join(PLAYLISTS_DIR, 'status.json'), JSON.stringify(telemetry, null, 2), 'utf-8');

  console.log(`🎉 Master Playlists Generated:`);
  console.log(`   - playlists/morningtv_all.m3u           (${verifiedChannels.length} Channels)`);
  console.log(`   - playlists/morningtv_india.m3u         (${categories.India.length} Channels)`);
  console.log(`   - playlists/morningtv_news.m3u          (${categories.News.length} Channels)`);
  console.log(`   - playlists/morningtv_sports.m3u        (${categories.Sports.length} Channels)`);
  console.log(`   - playlists/morningtv_movies.m3u        (${categories.Movies.length} Channels)`);
  console.log(`   - playlists/morningtv_entertainment.m3u (${categories.Entertainment.length} Channels)`);
  console.log(`   - playlists/morningtv_kids.m3u          (${categories.Kids.length} Channels)`);
  console.log(`   - playlists/morningtv_music.m3u         (${categories.Music.length} Channels)`);
  console.log(`   - playlists/status.json                 (Telemetry)`);
  console.log(`===============================================================\n`);
}

run();
