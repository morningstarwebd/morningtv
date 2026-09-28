# Security Policy

## Supported Versions

We release security updates for the following versions of MorningTV:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Architecture Security Guarantees

MorningTV enforces multi-layered defense-in-depth security:
- **In-Process Loopback Proxy**: Binds strictly to `127.0.0.1` and authenticates every request via cryptographic ephemeral session tokens (`X-Proxy-Token`).
- **Anti-SSRF & DNS-Rebinding Defense**: Actively inspects URI target hosts and performs asynchronous DNS resolution (`tokio::net::lookup_host`) to reject loopback (`127.0.0.0/8`, `::1`), private RFC1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local cloud metadata (`169.254.0.0/16`, `fe80::/10`), multicast, and broadcast addresses.
- **Strict Content Security Policy (CSP)**: WebView restricts scripts, network access, media, and styles.
- **Single-Instance Mutex**: Prevents race conditions and multiple processes accessing local SQLite state.

## Reporting a Vulnerability

If you discover a security vulnerability in MorningTV, please **do not** open a public issue.

Instead, please send an advisory report to:
- **Email**: `security@morningstar.dev` (or open a confidential GitHub Security Advisory via the [Security Tab](https://github.com/morningstarwebd/morningtv/security/advisories)).

Please include:
1. A description of the vulnerability and its potential impact.
2. Steps to reproduce or a Proof-of-Concept (PoC).
3. Any proposed remediations.

We will acknowledge receipt of your vulnerability report within 48 hours and work with you to release a coordinated disclosure and patch.
