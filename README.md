# pjos-website

The PJOS Linux landing site: a single static `index.html` (inline CSS/JS) plus assets and
screenshots, deployed to GitHub Pages by `.github/workflows/pages.yml` (CNAME in `CNAME`).

## Run

```sh
python3 -m http.server 8098 --bind 127.0.0.1
# open http://127.0.0.1:8098/
```

No build step and no dependencies. The theme toggle stores the choice in `localStorage`
(`pjos-theme`), so light/dark deep links are deterministic.

## Screenshots

```sh
python3 -m http.server 8098 --bind 127.0.0.1 &
CHROME_BIN=/usr/bin/google-chrome node tools/capture-screenshots.mjs \
  http://127.0.0.1:8098 docs/screenshots
```

Captures desktop (1440×900) and mobile (390×844) in dark and light, asserts the theme really
applied and that there is no horizontal overflow, and writes `docs/screenshots/manifest.json`
with the run timestamp and SHA-256. See `VERIFICATION.md` for the 2026-10-31 run.
