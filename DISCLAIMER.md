# Legal Notice, Stream Auditing Policy & DMCA Disclaimer

### 1. Stream Health Auditor & Indexing Client
**MorningTV** is an automated open-source stream quality auditor and native desktop player client.
- MorningTV **does not host, broadcast, archive, or re-transmit any media files, audio, or video streams.**
- All indexed playlist entries originate purely algorithmically from publicly available third-party directories (such as `iptv-org` and public web sources).
- MorningTV acts solely as a **technical conduit and quality filter**: probing public streams to purge dead/broken links and delivering an optimized, low-latency playback experience. The project maintainers have no editorial control over upstream servers or broadcasters.

### 2. Intellectual Property & Fair Use
- All channel names, brand marks, and broadcast trademarks belong solely to their respective intellectual property holders.
- Channel metadata and icons are displayed strictly under **nominative fair use** for channel identification and user navigation.
- MorningTV does not endorse, sponsor, or claim any official affiliation with any broadcast network or content provider.

### 3. Safe Harbor & Persistent DMCA Takedown Procedure
MorningTV strictly adheres to the **Digital Millennium Copyright Act (17 U.S.C. § 512)** and international copyright directives.

If you are a copyright owner or an authorized representative and believe an indexed stream should be removed:
1. **File an Official Takedown Request**: Open an issue using our [DMCA Takedown Request Template](.github/ISSUE_TEMPLATE/dmca.yml).
2. **Permanent Exclusion**: Upon receipt of a valid notice, the offending channel, domain, or identifier is permanently added to our **Persistent Exclusion Database (`playlists/dmca_blacklist.json`)**.
3. **Automated Purge**: Our automated Tokio Sentinel engine enforces this database on every build cycle, permanently suppressing and deleting the requested stream within 24–48 hours without dispute.

---
*Last updated: 2026*
