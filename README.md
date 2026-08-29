# Portfolio

The source of my personal site. A complete, self-contained static website —
my CV, the projects behind it, and the live demos, all in one deployable unit.

**Live:** <https://pr1317.github.io> — also on Railway at
<https://portfolio-production-f8b6.up.railway.app>, from the same tree.

## Deploying it

The site is pure static files. There is no build step, no database and no
server-side code, so it deploys anywhere that can serve a directory.

### GitHub Pages

`pr1317/pr1317.github.io` is a mirror of this repository, served at the short
URL above. It is a copy rather than a submodule or a build step, because a user
site is served from the default branch root and nothing here needs building.

This repository stays the source of truth. To publish a change:

```bash
tar --exclude='./.git' -cf - . | (cd ../pr1317.github.io && tar -xf -)
cd ../pr1317.github.io && git add -A && git commit -m "Sync from portfolio" && git push
```

The Railway-specific files (`Caddyfile`, `Dockerfile`, `railway.json`,
`render.yaml`) travel with the mirror and are simply unused there. Pages serves
`404.html` for unknown paths on its own, and `.nojekyll` stops it running the
tree through Jekyll.

### Railway

Already configured — `railway.json` pins the Docker builder and a healthcheck.
Point a Railway service at this repository and it builds the `Dockerfile` and
serves it. Nothing else to set; Railway injects `$PORT` and the Caddyfile reads it.

```bash
railway up
```

### Render

`render.yaml` is a Blueprint. From the Render dashboard choose **New →
Blueprint**, point it at this repository, and it creates a free static site
serving the repository root with the cache and security headers already set.

To run the container on Render instead of the static service, swap the
commented block at the bottom of `render.yaml` — it uses the same Dockerfile.

### Anywhere else (or locally)

```bash
docker build -t portfolio . && docker run -p 8080:8080 portfolio
```

The image is `caddy:2.11-alpine` plus the site, so it runs identically on Fly,
Cloud Run, a VPS or a laptop. Without Docker, any static file server works:

```bash
python3 -m http.server 8000
```

## What's here

```
index.html            the portfolio page
404.html              self-contained error page — no external dependencies
assets/css/style.css  hand-written CSS, dark and light themes
assets/js/main.js     ~200 lines of vanilla JS, no libraries
demos/opslab/         live SLA breach scorer (bundled from its own repo)
demos/churn/          live churn scorer      (bundled from its own repo)
demos/digits/         live digit recogniser  (bundled from its own repo)
demos/traffic/        annotated playback     (bundled from its own repo)
Caddyfile             static serving: compression, caching, headers, 404
Dockerfile            caddy:2.11-alpine + the site
railway.json          Railway build and deploy config
render.yaml           Render Blueprint
```

The four demos are vendored copies of each project's own demo directory, so the
site has no external runtime dependency: every link on the page resolves within
this deployment. Their sources of truth remain
[opslab](https://github.com/pr1317/opslab),
[customer-churn-analytics](https://github.com/pr1317/customer-churn-analytics),
[handwritten-digit-recognition](https://github.com/pr1317/handwritten-digit-recognition)
and [smart-traffic-management](https://github.com/pr1317/smart-traffic-management).

To refresh a demo, re-copy `docs/` from its repository. opslab keeps its demo in
`web/` and generates two of the five files, so its refresh is:

```bash
cd ../opslab
opslab export --out web/demo-data.js      # the fitted models, as data
opslab try --out out/try && cp out/try/report.html web/report.html
cp web/{index.html,app.js,opslab.js,demo-data.js,report.html} ../portfolio/demos/opslab/
```

## The projects it links to

| Project | What it is | Demo |
|---|---|---|
| [opslab](https://github.com/pr1317/opslab) | Operations analytics for BFSI back-office processes — process mining, SPC, SLA survival analysis and a Power BI model linter, on the standard library alone | `/demos/opslab/` |
| [handwritten-digit-recognition](https://github.com/pr1317/handwritten-digit-recognition) | 98.48% on MNIST; the finding is that deskewing beats model choice | `/demos/digits/` |
| [customer-churn-analytics](https://github.com/pr1317/customer-churn-analytics) | ROC-AUC 0.846, and whether acting on the prediction pays for itself | `/demos/churn/` |
| [smart-traffic-management](https://github.com/pr1317/smart-traffic-management) | YOLOv4-tiny and a centroid tracker turning a highway camera into telemetry | `/demos/traffic/` |

## Notes on the build

- **No framework, no bundler, no tracking.** One HTML file, one stylesheet,
  ~200 lines of vanilla JS, and four vendored demos.
- **Responsive** from 320px up. Verified for horizontal overflow and touch
  target size at ten widths between 320 and 1920.
- **Themes.** Dark by default; the toggle persists a choice in `localStorage`
  and every access is wrapped, so private browsing cannot break it. An inline
  script in `<head>` applies a stored theme before first paint — no flash.
- **Degrades safely.** Content is visible by default and only hidden for the
  entrance animation once the boot script runs, so a blocked or failed
  `main.js` cannot leave the page blank.
- **The error page is self-contained** — inline CSS, no web font, no script.
  It is served at whatever wrong URL a visitor hit, so a relative asset path
  would resolve against *that* path and 404 in turn.
- **`prefers-reduced-motion`** is honoured; **print** produces a clean
  CV-style document.
- **Serving**: gzip/zstd compression (the stylesheet goes 28.6 KB → 7.2 KB),
  `no-cache` on HTML so a redeploy is visible immediately, longer caches on
  demo frames and model weights, and `nosniff` / `Referrer-Policy` /
  `X-Frame-Options` on everything.

## A note on the numbers

Every figure on the page traces to a source: the workplace metrics come from my
CV, and each project metric is the one its own repository measures and can
defend. Where a rounder number was available I used the defensible one instead —
the traffic project, for example, reports near-field recall rather than an
overall "detection accuracy", because the clip it runs on ships without labels
and there is nothing to measure such a figure against.
