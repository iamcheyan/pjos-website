# Verification — pjos-website @ 2026-10-31

- Verdict: PASS
- Commit: `__COMMIT__` (favicon + capture harness; this document is the following commit)
- Remote: `__REMOTE__`
- Runtime: static site served by `python3 -m http.server 8098 --bind 127.0.0.1` from the repo root
- Toolchain: node v22.23.3, Chrome 155.0.8059.84, Python 3.13

## Test gate
| command | result | notes |
|---|---|---|
| `python3 -m http.server` + `GET /` | PASS | HTTP 200, title “PJOS Linux — PocketJS 驱动的便携设备系统” |
| `node tools/capture-screenshots.mjs` | PASS | 4/4 states, 4 unique hashes, no overflow, theme applied, no duplicate/blank frames |
| `tools/probe.mjs` (1280-class + phone) | PASS | HTTP 200 at 1440×900 and 390×844; no console errors, no failed/4xx requests, no horizontal overflow |

The deploy workflow `.github/workflows/pages.yml` uploads the repository root as the Pages
artifact; the same root served locally is what was captured.

## Screenshot matrix
All four files were regenerated this run from the local static server. The script navigates at
each viewport, forces the requested theme through the real `#theme` control, asserts
`body.light` matches the filename, and captures the viewport.

| file | viewport | theme | path | note |
|---|---|---|---|---|
| desktop-dark.png | 1440×900 | dark | `docs/screenshots/desktop-dark.png` | |
| desktop-light.png | 1440×900 | light | `docs/screenshots/desktop-light.png` | |
| mobile-390-dark.png | 390×844 | dark | `docs/screenshots/mobile-390-dark.png` | |
| mobile-390-light.png | 390×844 | light | `docs/screenshots/mobile-390-light.png` | |

Count: 4 screenshots, 4 unique hashes (0 duplicates). `tools/check_shots.py`: valid PNGs,
1440×900 desktop and 390×844 mobile, minimum RGB stddev 24.94, no blank frames.
`docs/screenshots/manifest.json` records the timestamp, URL and SHA-256 of each file.

## Fixed
- The site had no reproducible capture path; the four committed images could only be produced by
  an ad-hoc manual browser session. → added a dependency-free `tools/capture-screenshots.mjs`
  (CDP: desktop 1440×900 + mobile 390×844, light/dark, theme-applied assertion, overflow/hash
  gates, manifest) and a root `README.md` → `tools/capture-screenshots.mjs`, `README.md`.
- Every first load logged a 404 for `/favicon.ico`. → added `favicon.svg` and the
  `<link rel="icon">` in `index.html`; the probe is now clean at both viewports.
- Replaced the four stale screenshots with this run's bytes and recorded their hashes.

## Blocked / open questions
- None. The site is static; the GitHub Pages deployment itself was not triggered from this host
  (no need to publish a page to verify the artifact).

## Not verified here
- 掌机真机（RG34XX / PJOS-LINUX）未验证；本轮只在本机 headless Chrome 里跑真实进程。
- GitHub Pages CDN propagation / DNS for the CNAME; only the local static artifact was served.
