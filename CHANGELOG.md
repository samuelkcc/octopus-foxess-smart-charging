# Changelog

## v2026.07.11 — 2026-07-11

- Split the maintainable application source into HTML, CSS, and JavaScript files.
- Added a reproducible `npm run build` standalone SPA output.
- Fixed stale Active Mode Scheduler updates after FoxESS schedule writes.
- Hardened schedule retries so disabled padding cannot become active ghost schedules.
- Added explicit handling and warnings for the FoxESS five-period scheduler limit.
- Prevented duplicate background refresh timers and unnecessary API calls.
- Added encrypted persistent credential storage with a session-only fallback.
- Added request timeouts, HTTP error handling, safer dynamic rendering, pinned CDN assets, and regression tests.
