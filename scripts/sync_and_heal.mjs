// scripts/sync_and_heal.mjs
// MorningTV Stream Sentinel & Auto-Healing Engine
// Deeply audits public IPTV sources, filters out fake/dead links, and builds 100% verified playlists.

import dns from 'node:dns';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Force IPv4 first to prevent DNS timeouts on Windows
dns.setDefaultResultOrder('ipv4first');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLAYLISTS_DIR = path.resolve(__dirname, '../playlists');

if (!fs.existsSync(PLAYLISTS_DIR)) {
  fs.mkdirSync(PLAYLISTS_DIR, { recursive: true });
}

// Curated Public Upstream Sources
const UPSTREAM_SOURCES = [
  {
    name: 'IPTV-Org India & Regional',
    url: 'https://iptv-org.github.io/iptv/countries/in.m3u',
    defaultGroup: 'India'
  },
  {
    name: 'Free-TV Global Master',
    url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8',
    defaultGroup: 'General'
  }
];

// Helper to fetch text with timeout
async function fetchText(url, timeoutMs = 20000) {
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
    console.warn(`[Upstream Warning] Failed to fetch ${url}: ${err.message}`);
    return null;
  }
}

// Parse M3U content into raw channel objects
function parseM3u(content, fallbackGroup) {
  const lines = content.split('\n');
  const channels = [];
  let currMeta = null;

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
    } else if (line.startsWith('http://') || line.startsWith('https://')) {
      if (currMeta) {
        channels.push({
          ...currMeta,
          url: line
        });
        currMeta = null;
      }
    }
  }

  return channels;
}

// Deep actual packet verification
async function verifyStream(channel) {
  try {
    const signal = AbortSignal.timeout(3500); // 3.5s per probe
    const res = await fetch(channel.url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*'
      },
      redirect: 'follow',
      signal
    });

    const finalUrl = res.url || channel.url;
    const isRedirected = res.redirected && finalUrl !== channel.url;

    if (!res.ok) {
      return { alive: false, channel };
    }

    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    
    // Quick reject if explicitly HTML
    if (ctype.includes('text/html') || ctype.includes('text/xml')) {
      return { alive: false, channel };
    }

    // Read the first chunk (up to 4KB) of body to verify playlist
    const reader = res.body.getReader();
    const { value: chunk } = await reader.read();
    reader.cancel(); // Cancel remainder of stream immediately to save bandwidth

    if (!chunk || chunk.length === 0) {
      return { alive: false, channel };
    }

    const textSnippet = new TextDecoder('utf-8', { fatal: false }).decode(chunk.slice(0, 512)).toLowerCase();

    // Reject fake 200 HTML pages (Cloudflare blocks, landing pages, 404 wrappers)
    if (
      textSnippet.includes('<html') ||
      textSnippet.includes('<!doctype') ||
      textSnippet.includes('access denied') ||
      textSnippet.includes('error 404') ||
      textSnippet.includes('channel offline')
    ) {
      return { alive: false, channel };
    }

    const isHls = textSnippet.includes('#extm3u') || textSnippet.includes('#ext-x-') || textSnippet.includes('#extinf') || textSnippet.includes('.ts') || textSnippet.includes('.m4s');
    const isTs = chunk[0] === 0x47 || (chunk.length > 188 && chunk[188] === 0x47);
    const isMedia = ctype.includes('mpegurl') || ctype.includes('video/') || ctype.includes('audio/') || ctype.includes('octet-stream');

    if (isHls || isTs || (isMedia && !textSnippet.includes('<html'))) {
      return {
        alive: true,
        channel: {
          ...channel,
          url: isRedirected ? finalUrl : channel.url
        }
      };
    }

    return { alive: false, channel };
  } catch (err) {
    return { alive: false, channel };
  }
}

async function run() {
  console.log(`\n======================================================`);
  console.log(`🌅 MorningTV Sentinel: Starting Upstream Sync & Heal`);
  console.log(`======================================================\n`);

  const rawChannels = [];
  const seenUrls = new Set();

  for (const src of UPSTREAM_SOURCES) {
    console.log(`📥 Fetching upstream: ${src.name}...`);
    const content = await fetchText(src.url);
    if (!content) continue;

    const parsed = parseM3u(content, src.defaultGroup);
    let added = 0;
    for (const ch of parsed) {
      if (!seenUrls.has(ch.url)) {
        seenUrls.add(ch.url);
        rawChannels.push(ch);
        added++;
      }
    }
    console.log(`   -> Extracted ${parsed.length.toLocaleString()} items (${added.toLocaleString()} unique).`);
  }

  console.log(`\n📊 Total raw channels gathered: ${rawChannels.length.toLocaleString()}`);

  // Test top 600 candidate streams (balanced for CI and speed)
  const AUDIT_LIMIT = Math.min(rawChannels.length, 600);
  const candidates = rawChannels.slice(0, AUDIT_LIMIT);

  console.log(`🔍 Probing ${candidates.length.toLocaleString()} streams with 40 parallel cloud workers...\n`);

  const CONCURRENCY = 40;
  let queueIdx = 0;
  let completed = 0;
  const verifiedChannels = [];
  let deadCount = 0;
  let updatedCount = 0;

  async function worker() {
    while (queueIdx < candidates.length) {
      const idx = queueIdx++;
      const res = await verifyStream(candidates[idx]);
      completed++;

      if (res.alive) {
        verifiedChannels.push(res.channel);
        if (res.channel.url !== candidates[idx].url) {
          updatedCount++;
        }
      } else {
        deadCount++;
      }

      if (completed % 50 === 0 || completed === candidates.length) {
        process.stdout.write(`   [Auditing] ${completed}/${candidates.length} (${verifiedChannels.length} Playable, ${deadCount} Dead)\r`);
      }
    }
  }

  const startTime = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n\n✅ Audit Complete in ${elapsedSec}s!`);
  console.log(`   👉 Verified Playable: ${verifiedChannels.length.toLocaleString()}`);
  console.log(`   👉 Dead Removed:     ${deadCount.toLocaleString()}`);
  console.log(`   👉 Auto-Healed URLs: ${updatedCount.toLocaleString()}`);

  // Categorize
  const categoryMap = {
    News: [],
    Entertainment: [],
    Sports: [],
    Kids: [],
    India: []
  };

  for (const ch of verifiedChannels) {
    const g = (ch.group || '').toLowerCase();
    const n = (ch.name || '').toLowerCase();

    if (g.includes('news') || n.includes('news') || n.includes('samachar') || n.includes('khabar')) {
      categoryMap.News.push(ch);
    } else if (g.includes('sport') || n.includes('sport') || n.includes('cricket') || n.includes('football')) {
      categoryMap.Sports.push(ch);
    } else if (g.includes('kid') || g.includes('animat') || n.includes('cartoon') || n.includes('disney')) {
      categoryMap.Kids.push(ch);
    } else if (g.includes('india') || n.includes('bangla') || n.includes('hindi') || n.includes('dd ')) {
      categoryMap.India.push(ch);
    } else {
      categoryMap.Entertainment.push(ch);
    }
  }

  // Generate M3U playlist file content
  function generateM3uContent(list) {
    let out = '#EXTM3U\n';
    for (const ch of list) {
      out += `#EXTINF:-1 tvg-id="${ch.id}" tvg-name="${ch.name}" tvg-logo="${ch.logo}" group-title="${ch.group}",${ch.name}\n${ch.url}\n`;
    }
    return out;
  }

  // Write playlists
  console.log(`\n💾 Writing verified playlists to disk...`);

  fs.writeFileSync(path.join(PLAYLISTS_DIR, 'morningtv_all.m3u'), generateM3uContent(verifiedChannels), 'utf-8');
  fs.writeFileSync(path.join(PLAYLISTS_DIR, 'morningtv_news.m3u'), generateM3uContent(categoryMap.News), 'utf-8');
  fs.writeFileSync(path.join(PLAYLISTS_DIR, 'morningtv_sports.m3u'), generateM3uContent(categoryMap.Sports), 'utf-8');
  fs.writeFileSync(path.join(PLAYLISTS_DIR, 'morningtv_kids.m3u'), generateM3uContent(categoryMap.Kids), 'utf-8');
  fs.writeFileSync(path.join(PLAYLISTS_DIR, 'morningtv_entertainment.m3u'), generateM3uContent(categoryMap.Entertainment), 'utf-8');
  fs.writeFileSync(path.join(PLAYLISTS_DIR, 'morningtv_india.m3u'), generateM3uContent(categoryMap.India), 'utf-8');

  // Telemetry status
  const status = {
    updated_at: new Date().toISOString(),
    engine: 'MorningTV Cloud Sentinel 1.0',
    total_candidates_scanned: candidates.length,
    playable_channels: verifiedChannels.length,
    dead_filtered: deadCount,
    links_healed: updatedCount,
    health_score: `${((verifiedChannels.length / candidates.length) * 100).toFixed(1)}%`,
    categories: {
      all: verifiedChannels.length,
      news: categoryMap.News.length,
      sports: categoryMap.Sports.length,
      kids: categoryMap.Kids.length,
      entertainment: categoryMap.Entertainment.length,
      india: categoryMap.India.length
    }
  };

  fs.writeFileSync(path.join(PLAYLISTS_DIR, 'status.json'), JSON.stringify(status, null, 2), 'utf-8');

  console.log(`🎉 Success! Generated:`);
  console.log(`   - playlists/morningtv_all.m3u (${verifiedChannels.length} channels)`);
  console.log(`   - playlists/morningtv_news.m3u (${categoryMap.News.length} channels)`);
  console.log(`   - playlists/morningtv_sports.m3u (${categoryMap.Sports.length} channels)`);
  console.log(`   - playlists/morningtv_kids.m3u (${categoryMap.Kids.length} channels)`);
  console.log(`   - playlists/morningtv_entertainment.m3u (${categoryMap.Entertainment.length} channels)`);
  console.log(`   - playlists/morningtv_india.m3u (${categoryMap.India.length} channels)`);
  console.log(`   - playlists/status.json (Live telemetry)`);
  console.log(`======================================================\n`);
}

run();
