# 🌅 MorningTV — Automated Stream Sentinel & Verified Master Playlists

<p align="center">
  <img src="https://raw.githubusercontent.com/morningstarwebd/morningtv/main/assets/banner.png" alt="MorningTV Banner" width="700" onerror="this.style.display='none'"/>
</p>

<p align="center">
  <b>100% Verified, Bufferless & Auto-Healed Public IPTV Playlists</b><br>
  <i>Audited every 12 hours via GitHub Actions • Zero Dead Streams • Pure Legal FTA & FAST Channels</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Sentinel-Auto--Healing-emerald?style=for-the-badge&logo=githubactions&logoColor=white" alt="Sentinel Status"/>
  <img src="https://img.shields.io/badge/Streams-100%25%20Verified-blue?style=for-the-badge" alt="Verified Status"/>
  <img src="https://img.shields.io/badge/License-MIT-amber?style=for-the-badge" alt="License"/>
</p>

---

## ⚡ Why MorningTV?

Most public IPTV playlists on the internet are plagued with **over 90% dead, offline, or expired streams**. 

**MorningTV** solves this once and for all:
- **Deep Packet Inspection:** Every stream is probed at the byte level — verifying true `#EXTM3U` HLS headers and MPEG-TS sync bytes (`0x47`). Fake `200 OK` HTML error wrappers are automatically purged.
- **Self-Healing URL Resolution:** When a stream changes domain or redirects (301/302), MorningTV detects the new endpoint and auto-updates the playlist.
- **Automated Cloud Verification:** A GitHub Actions cron job runs every 12 hours in the cloud with gigabit uplinks, ensuring playlists are perpetually fresh.
- **100% Legal & Clean:** Indexes strictly Free-To-Air (FTA), public domain broadcasts, and legal FAST feeds.

---

## 📺 Live Curated Playlists (Direct URLs)

Copy and paste any of the following raw URLs directly into **MorningTV Player**, **VLC Media Player**, **Kodi**, or any IPTV app:

| Playlist | Channels | Raw URL |
| :--- | :--- | :--- |
| 🌐 **Master (All Channels)** | 100% Alive | `https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_all.m3u` |
| 📰 **News & World** | Live 24/7 | `https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_news.m3u` |
| 🎬 **Movies & Entertainment** | Full HD | `https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_entertainment.m3u` |
| ⚽ **Sports Live** | Verified | `https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_sports.m3u` |
| 👶 **Kids & Animation** | Family | `https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_kids.m3u` |
| 🇮🇳 **India & Regional** | Hindi / Bangla | `https://raw.githubusercontent.com/morningstarwebd/morningtv/main/playlists/morningtv_india.m3u` |

---

## 🛠️ How It Works (Cloud Architecture)

```
[Upstream Public Feeds] (Free-TV, Curated IPTV-Org, FAST Networks)
          │
          ▼
[GitHub Actions Cloud Runner] (Runs every 12 Hours)
          │
          ▼
[Deep Stream Sentinel Engine]
  ├── Tests Range: bytes=0-1024
  ├── Validates #EXTM3U & TS 0x47 Sync Byte
  ├── Purges 404/Cloudflare/HTML Fake Pages
  └── Auto-Tracks & Saves 301/302 Redirects
          │
          ▼
[Output Clean Master Playlists]
  └── Auto-Committed & Pushed to GitHub
          │
          ▼
[Instant Stream Playback on MorningTV Player / VLC]
```

---

## 🚀 Running the Audit Locally

You can test and run the Stream Sentinel locally on your computer:

```bash
# Clone the repository
git clone https://github.com/morningstarwebd/morningtv.git
cd morningtv

# Run the Sentinel audit
npm run sync
```

---

## 📜 Legal & Disclaimer

MorningTV is an automated indexer and does **not** host, store, or transmit any video or media content. Please read the full [DISCLAIMER.md](DISCLAIMER.md) for copyright and DMCA compliance information.
