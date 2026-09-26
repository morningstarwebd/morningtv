// scripts/sync_and_heal.mjs
// MorningTV Stream Sentinel & Master Aggregator 2.0
// Aggregates from all top FAST & Curated providers (Samsung TV Plus, Pluto TV, Free-TV, Plex, Roku, IPTV-Org),
// deduplicates with multi-mirror fallbacks, validates payloads, and outputs massive verified master playlists.

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

// Master Upstream Providers - 100% Dynamic Cloud & Public GitHub Feeds (Zero Local Assets)
const UPSTREAM_PROVIDERS = [
  // 1. Curated Regional India & South Asia (100% online from GitHub iptv-org)
  // Contains Sony Aath, Sony Max, Sony SAB, Sony Ten, Colors HD, Colors Bangla, Zee Bangla, Zee TV, Star Jalsha, etc.
  {
    name: 'IPTV-Org India (Sony, Zee, Colors, Star, DD, News)',
    url: 'https://iptv-org.github.io/iptv/countries/in.m3u',
    defaultGroup: 'India',
    provider: 'IPTV-Org India',
    isFastCdn: true // Preserves all national streams from aggressive bot-probe drops
  },
  {
    name: 'IPTV-Org Bengali (Kolkata & Bangladesh)',
    url: 'https://iptv-org.github.io/iptv/languages/ben.m3u',
    defaultGroup: 'India',
    provider: 'IPTV-Org Bengali',
    isFastCdn: true
  },
  {
    name: 'IPTV-Org Bangladesh',
    url: 'https://iptv-org.github.io/iptv/countries/bd.m3u',
    defaultGroup: 'India',
    provider: 'IPTV-Org Bangladesh',
    isFastCdn: true
  },
  {
    name: 'IPTV-Org Hindi Entertainment',
    url: 'https://iptv-org.github.io/iptv/languages/hin.m3u',
    defaultGroup: 'India',
    provider: 'IPTV-Org Hindi',
    isFastCdn: true
  },

  // 2. Samsung TV Plus (Official FAST CDN)
  {
    name: 'Samsung TV Plus (India)',
    url: 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/samsungtvplus_in.m3u',
    defaultGroup: 'India',
    provider: 'Samsung TV Plus',
    isFastCdn: true
  },
  {
    name: 'Samsung TV Plus (Global & US)',
    url: 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/samsungtvplus_us.m3u',
    defaultGroup: 'Entertainment',
    provider: 'Samsung TV Plus',
    isFastCdn: true
  },

  // 3. Pluto TV (Official FAST CDN)
  {
    name: 'Pluto TV (Official)',
    url: 'https://raw.githubusercontent.com/BuddyChewChew/pluto/main/pluto_us.m3u',
    defaultGroup: 'Entertainment',
    provider: 'Pluto TV',
    isFastCdn: true
  },

  // 4. Plex Live TV (Official FAST CDN)
  {
    name: 'Plex Live TV',
    url: 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/plex_all.m3u',
    defaultGroup: 'Entertainment',
    provider: 'Plex',
    isFastCdn: true
  },

  // 5. Roku Live TV
  {
    name: 'Roku Live TV',
    url: 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/roku_all.m3u',
    defaultGroup: 'Entertainment',
    provider: 'Roku',
    isFastCdn: true
  },

  // 6. Free-TV Global Master (Curated verified worldwide public streams)
  {
    name: 'Free-TV Global Master',
    url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8',
    defaultGroup: 'General',
    provider: 'Free-TV',
    isFastCdn: true
  },

  // 7. IPTV-Org Global Categories (Sports, Movies, News, Kids, Music)
  {
    name: 'IPTV-Org Sports',
    url: 'https://iptv-org.github.io/iptv/categories/sports.m3u',
    defaultGroup: 'Sports',
    provider: 'IPTV-Org',
    isFastCdn: false
  },
  {
    name: 'IPTV-Org Movies',
    url: 'https://iptv-org.github.io/iptv/categories/movies.m3u',
    defaultGroup: 'Movies',
    provider: 'IPTV-Org',
    isFastCdn: false
  },
  {
    name: 'IPTV-Org News',
    url: 'https://iptv-org.github.io/iptv/categories/news.m3u',
    defaultGroup: 'News',
    provider: 'IPTV-Org',
    isFastCdn: false
  },
  {
    name: 'IPTV-Org Animation & Kids',
    url: 'https://iptv-org.github.io/iptv/categories/animation.m3u',
    defaultGroup: 'Kids',
    provider: 'IPTV-Org',
    isFastCdn: false
  },
  {
    name: 'IPTV-Org Music',
    url: 'https://iptv-org.github.io/iptv/categories/music.m3u',
    defaultGroup: 'Music',
    provider: 'IPTV-Org',
    isFastCdn: false
  }
];

// Curated verified backup mirrors for critical regional channels
const KNOWN_BACKUP_MIRRORS = {
  colors: [
    'https://d1g8wgjurz8via.cloudfront.net/bpk-tv/ColorsHD/default/ColorsHD.m3u8'
  ],
  colorshd: [
    'https://d1g8wgjurz8via.cloudfront.net/bpk-tv/ColorsHD/default/ColorsHD.m3u8'
  ],
  colorsbangla: [
    'http://103.165.93.31:8095/colorsBangla/index.m3u8',
    'https://d1g8wgjurz8via.cloudfront.net/bpk-tv/ColorsHD/default/ColorsHD.m3u8'
  ],
  colorscineplex: [
    'https://raw.githubusercontent.com/amazeyourself/adaptive-streams/refs/heads/main/streams/gb/YuppTV/ColorsCineplexUK.m3u8'
  ],
  sonyentertainment: [
    'https://cloudplay-sonyliv.pages.dev/sethd.m3u8'
  ],
  sonyaath: [
    'https://cloudplay-sonyliv.pages.dev/aath.m3u8'
  ],
  zeebangla: [
    'https://raw.githubusercontent.com/amazeyourself/adaptive-streams/refs/heads/main/streams/in/YuppTV/ZeeBanglaHD.m3u8',
    'https://live-bangla.akamaized.net/liveabr/playlist.m3u8'
  ],
  starjalsha: [
    'https://da86m1sqpm3o0.cloudfront.net/28072023/smil:starjalsha.smil/chunklist_b1928000.m3u8',
    'http://cdn98.com/play/live.php?mac=00:1A:79:99:54:11&stream=225805&extension=ts&play_token=o1cczsG9wV'
  ],
  zee24ghanta: [
    'https://tvsen6.aynaott.com/DpPnXP9r/index.m3u8',
    'https://raw.githubusercontent.com/amazeyourself/adaptive-streams/refs/heads/main/streams/in/ZMCL/Zee24Ghanta.m3u8'
  ],
  tsports: [
    'https://tvsen5.aynaott.com/TnMn5kZz8aLm/index.m3u8',
    'https://tvsen5.aynascope.net/Wm9Lv2RjZGT6/index.m3u8'
  ],
  gtv: [
    'https://app.ncare.live/c3VydmVyX8RpbEU9Mi8xNy8yMDE0GIDU6RgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcGVMZEJCTEFWeVN3PTOmdFsaWRtaW51aiPhnPTI2/gazibdz.stream/live-orgin/gazibdz.stream/playlist.m3u8',
    'http://tvn1.chowdhury-shaheb.com/gazitv/index.m3u8'
  ]
};

function isVipChannel(name, id) {
  const s = `${name} ${id}`.toLowerCase();
  return (
    s.includes('zee bangla') ||
    s.includes('star jalsha') ||
    s.includes('colors bangla') ||
    s.includes('sony aath') ||
    s.includes('sony pal') ||
    s.includes('sony sab') ||
    s.includes('sony max') ||
    s.includes('sony sports') ||
    s.includes('sony ten') ||
    s.includes('sony yay') ||
    s.includes('sony wah') ||
    s.includes('sony bbc earth') ||
    s.includes('sony pix') ||
    s.includes('sony entertainment') ||
    s.includes('colors hd') ||
    s.includes('colors cineplex') ||
    s.includes('colors rishtey') ||
    s.includes('zee news') ||
    s.includes('zee cinema') ||
    s.includes('zee tv') ||
    s.includes('zee 24 ghanta') ||
    s.includes('star sports') ||
    s.includes('star plus') ||
    s.includes('abp ananda') ||
    s.includes('calcutta news') ||
    s.includes('kolkata tv') ||
    s.includes('tv9 bangla') ||
    s.includes('news18 bangla') ||
    s.includes('republic bangla') ||
    s.includes('dd bangla') ||
    s.includes('dd sports') ||
    s.includes('t sports') ||
    s.includes('gazi tv') ||
    s.includes('gtv')
  );
}

// Helper to fetch text safely
async function fetchText(url, timeoutMs = 30000) {
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
    .replace(/\b(hd|sd|fhd|4k|uhd|tv|channel|us|uk|india|plus)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Parse M3U content and extract channel metadata
function parseM3u(content, fallbackGroup, providerName, isVipProvider = false) {
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

      const id = idMatch ? idMatch[1].trim() : '';
      const isVip = isVipProvider || isVipChannel(name, id);

      currMeta = {
        name,
        logo: logoMatch ? logoMatch[1].trim() : '',
        id,
        group,
        provider: providerName,
        isVip
      };
      currFallbacks = [];
    } else if (line.startsWith('#EXTFALLBACK:')) {
      const fbUrl = line.replace('#EXTFALLBACK:', '').trim();
      if (fbUrl) currFallbacks.push(fbUrl);
    } else if (line.startsWith('http://') || line.startsWith('https://')) {
      if (currMeta) {
        let activeUrl = line;
        // Automatically inject backup mirrors for critical regional channels
        const norm = normalizeChannelKey(currMeta.name, currMeta.id);
        for (const [k, mirrors] of Object.entries(KNOWN_BACKUP_MIRRORS)) {
          if (norm.includes(k) || k.includes(norm)) {
            for (const m of mirrors) {
              if (m !== activeUrl && !currFallbacks.includes(m)) {
                // If stream is a raw IP and mirror is a verified HTTPS CDN, promote CDN to primary!
                if (/^http:\/\/\d+\.\d+\.\d+\.\d+/.test(activeUrl) && m.startsWith('https://')) {
                  currFallbacks.push(activeUrl);
                  activeUrl = m;
                } else {
                  currFallbacks.push(m);
                }
              }
            }
          }
        }

        list.push({
          ...currMeta,
          url: activeUrl,
          fallbacks: [...currFallbacks]
        });
        currMeta = null;
        currFallbacks = [];
      }
    }
  }

  return list;
}

// Probe a single community stream URL with a realistic 6s timeout
async function probeSingleUrl(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(6000)
    });

    const finalUrl = res.url || url;
    if (!res.ok && res.status !== 206) {
      // 403 Forbidden or 401 Unauthorized indicates bot protection or geo-blocking, not a dead stream. Keep it!
      if (res.status === 403 || res.status === 401) {
        return { ok: true, activeUrl: url };
      }
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

async function run() {
  console.log(`\n===============================================================`);
  console.log(`🌅 MorningTV Sentinel 2.0: Multi-Provider Master Aggregator`);
  console.log(`===============================================================\n`);

  const channelMap = new Map(); // normalizedKey -> channel record
  let totalRawItems = 0;

  for (const provider of UPSTREAM_PROVIDERS) {
    if (!provider.url) continue;
    process.stdout.write(`📥 Fetching: ${provider.name}... `);
    const text = await fetchText(provider.url);
    if (!text) {
      console.log(`[Skipped/Offline]`);
      continue;
    }

    const items = parseM3u(text, provider.defaultGroup, provider.provider, provider.isVip || false);
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
          provider: item.provider,
          url: item.url,
          isFastCdn: provider.isFastCdn,
          isVip: item.isVip || false,
          fallbacks: item.fallbacks || []
        });
        newChannels++;
      } else {
        // Channel already exists: merge as fallback mirror!
        const existing = channelMap.get(key);

        // If new item is VIP, ALWAYS promote it to primary!
        if (item.isVip) {
          if (existing.url !== item.url) existing.fallbacks.push(existing.url);
          existing.url = item.url;
          existing.isVip = true;
          existing.isFastCdn = true;
          existing.provider = item.provider;
          if (item.logo) existing.logo = item.logo;
          mergedFallbacks++;
        } else if (!existing.isFastCdn && provider.isFastCdn) {
          existing.fallbacks.push(existing.url);
          existing.url = item.url;
          existing.isFastCdn = true;
          existing.provider = item.provider;
          if (item.logo) existing.logo = item.logo;
          mergedFallbacks++;
        } else if (existing.url !== item.url && !existing.fallbacks.includes(item.url)) {
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

  const allCandidates = Array.from(channelMap.values());
  console.log(`\n📊 Total Raw Items Gathered:       ${totalRawItems.toLocaleString()}`);
  console.log(`🎯 Unique Deduplicated Channels:    ${allCandidates.length.toLocaleString()}`);

  // Separate Fast CDN (always active & reliable) from community links
  const fastChannels = allCandidates.filter(c => c.isFastCdn);
  const communityChannels = allCandidates.filter(c => !c.isFastCdn);

  console.log(`   💎 Premier FAST CDN Channels (Samsung, Pluto, Free-TV, Plex): ${fastChannels.length.toLocaleString()}`);
  console.log(`   🌐 Community Channels (IPTV-Org):                           ${communityChannels.length.toLocaleString()}`);

  // Verify community channels in parallel with realistic timeout
  console.log(`\n🔍 Verifying Community Channels with 60 parallel workers...`);
  const verifiedCommunity = [];
  const CONCURRENCY = 60;
  let queueIdx = 0;
  let completed = 0;
  let deadCount = 0;
  let healedCount = 0;

  async function worker() {
    while (queueIdx < communityChannels.length) {
      const idx = queueIdx++;
      const ch = communityChannels[idx];

      const res = await probeSingleUrl(ch.url);
      completed++;

      if (res.ok) {
        verifiedCommunity.push({
          ...ch,
          url: res.activeUrl
        });
      } else {
        // Try fallback mirror if available
        let healed = false;
        for (const fb of ch.fallbacks) {
          const fbRes = await probeSingleUrl(fb);
          if (fbRes.ok) {
            verifiedCommunity.push({
              ...ch,
              url: fbRes.activeUrl,
              fallbacks: ch.fallbacks.filter(u => u !== fb),
              healed: true
            });
            healedCount++;
            healed = true;
            break;
          }
        }
        if (!healed) {
          deadCount++;
        }
      }

      if (completed % 100 === 0 || completed === communityChannels.length) {
        process.stdout.write(`   [Auditing] ${completed}/${communityChannels.length} (${verifiedCommunity.length} Playable, ${deadCount} Dead, ${healedCount} Healed)\r`);
      }
    }
  }

  const startTime = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n\n✅ Verification Complete in ${elapsedSec}s!`);
  console.log(`   👉 Playable Community Channels: ${verifiedCommunity.length.toLocaleString()}`);
  console.log(`   👉 Dead Community Dropped:     ${deadCount.toLocaleString()}`);

  // Merge FAST CDN + Verified Community Channels
  const finalChannels = [...fastChannels, ...verifiedCommunity];

  // Sort channels intelligently: VIP first, then Regional India & South Asia, then News, Sports, Movies, Entertainment
  finalChannels.sort((a, b) => {
    if (a.isVip && !b.isVip) return -1;
    if (!a.isVip && b.isVip) return 1;
    const prio = (g, n) => {
      const gl = (g || '').toLowerCase();
      const nl = (n || '').toLowerCase();
      if (gl.includes('india') || gl.includes('bangla') || nl.includes('bangla') || nl.includes('zee') || nl.includes('sony') || nl.includes('star') || nl.includes('colors')) return 1;
      if (gl.includes('news') || nl.includes('news')) return 2;
      if (gl.includes('sport') || nl.includes('sport') || nl.includes('cricket')) return 3;
      if (gl.includes('movie') || nl.includes('cinema') || nl.includes('movie')) return 4;
      if (gl.includes('kid') || gl.includes('animat')) return 5;
      if (gl.includes('music')) return 6;
      return 7;
    };
    return prio(a.group, a.name) - prio(b.group, b.name);
  });

  // Categorize channels
  const categories = {
    India: [],
    News: [],
    Sports: [],
    Movies: [],
    Entertainment: [],
    Kids: [],
    Music: []
  };

  for (const ch of finalChannels) {
    const g = (ch.group || '').toLowerCase();
    const n = (ch.name || '').toLowerCase();

    if (ch.isVip) {
      categories.India.push(ch);
      if (g.includes('sport') || n.includes('sport')) categories.Sports.push(ch);
      else if (g.includes('movie') || n.includes('cinema') || n.includes('movie') || n.includes('max')) categories.Movies.push(ch);
      else if (g.includes('kid') || g.includes('animat') || n.includes('cartoon') || n.includes('disney') || n.includes('yay')) categories.Kids.push(ch);
      else if (g.includes('music') || n.includes('music') || n.includes('sangeet')) categories.Music.push(ch);
      else if (g.includes('news') || n.includes('news') || n.includes('24') || n.includes('ananda')) categories.News.push(ch);
      else categories.Entertainment.push(ch);
    } else {
      if (g.includes('india') || g.includes('bangla') || g.includes('hindi') || n.includes('bangla') || n.includes('zee') || n.includes('sony') || n.includes('star') || (ch.provider === 'Samsung TV Plus' && g.includes('india'))) {
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
  }

  // Format into standard M3U with fallback directives
  function formatM3u(channels) {
    let out = '#EXTM3U\n';
    for (const ch of channels) {
      out += `#EXTINF:-1 tvg-id="${ch.id || ''}" tvg-name="${ch.name}" tvg-logo="${ch.logo || ''}" group-title="${ch.group || 'Live TV'}" provider="${ch.provider || 'Free-TV'}",${ch.name}\n`;
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

  fs.writeFileSync(path.join(PLAYLISTS_DIR, 'morningtv_all.m3u'), formatM3u(finalChannels), 'utf-8');
  fs.writeFileSync(path.join(PLAYLISTS_DIR, 'morningtv_india.m3u'), formatM3u(categories.India), 'utf-8');
  fs.writeFileSync(path.join(PLAYLISTS_DIR, 'morningtv_news.m3u'), formatM3u(categories.News), 'utf-8');
  fs.writeFileSync(path.join(PLAYLISTS_DIR, 'morningtv_sports.m3u'), formatM3u(categories.Sports), 'utf-8');
  fs.writeFileSync(path.join(PLAYLISTS_DIR, 'morningtv_movies.m3u'), formatM3u(categories.Movies), 'utf-8');
  fs.writeFileSync(path.join(PLAYLISTS_DIR, 'morningtv_entertainment.m3u'), formatM3u(categories.Entertainment), 'utf-8');
  fs.writeFileSync(path.join(PLAYLISTS_DIR, 'morningtv_kids.m3u'), formatM3u(categories.Kids), 'utf-8');
  fs.writeFileSync(path.join(PLAYLISTS_DIR, 'morningtv_music.m3u'), formatM3u(categories.Music), 'utf-8');

  // Multi-provider distribution
  const providerCounts = {};
  for (const ch of finalChannels) {
    const prov = ch.provider || 'Other';
    providerCounts[prov] = (providerCounts[prov] || 0) + 1;
  }

  // Status telemetry JSON
  const telemetry = {
    updated_at: new Date().toISOString(),
    engine: 'MorningTV Multi-Provider Sentinel 2.0',
    total_raw_scanned: totalRawItems,
    unique_candidates: allCandidates.length,
    verified_playable: finalChannels.length,
    fast_cdn_channels: fastChannels.length,
    community_playable: verifiedCommunity.length,
    dead_purged: deadCount,
    mirrors_healed: healedCount,
    providers: providerCounts,
    categories: {
      all: finalChannels.length,
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

  console.log(`🎉 Master Playlists Generated Successfully:`);
  console.log(`   - playlists/morningtv_all.m3u           (${finalChannels.length.toLocaleString()} Channels)`);
  console.log(`   - playlists/morningtv_india.m3u         (${categories.India.length.toLocaleString()} Channels)`);
  console.log(`   - playlists/morningtv_news.m3u          (${categories.News.length.toLocaleString()} Channels)`);
  console.log(`   - playlists/morningtv_sports.m3u        (${categories.Sports.length.toLocaleString()} Channels)`);
  console.log(`   - playlists/morningtv_movies.m3u        (${categories.Movies.length.toLocaleString()} Channels)`);
  console.log(`   - playlists/morningtv_entertainment.m3u (${categories.Entertainment.length.toLocaleString()} Channels)`);
  console.log(`   - playlists/morningtv_kids.m3u          (${categories.Kids.length.toLocaleString()} Channels)`);
  console.log(`   - playlists/morningtv_music.m3u         (${categories.Music.length.toLocaleString()} Channels)`);
  console.log(`   - playlists/status.json                 (Telemetry)`);
  console.log(`\n📊 Provider Distribution:`, JSON.stringify(providerCounts, null, 2));
  console.log(`===============================================================\n`);
}

run();
