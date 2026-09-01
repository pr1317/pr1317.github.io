# pr1317.github.io

My personal site: my CV, the projects behind it, and the live demos, all in one
self-contained static website.

**Live:** <https://pr1317.github.io>

This repository is the published copy, served by GitHub Pages. The source of
truth is [pr1317/Portfolio](https://github.com/pr1317/Portfolio), which also
deploys the same tree to Railway; changes are made there and synced here. The
one deliberate difference is that the canonical URL, the Open Graph tags, the
sitemap and `robots.txt` in this copy point at `pr1317.github.io` rather than
at the Railway host, so the site a visitor lands on is the site it describes
itself as.

## Deploying it

Pure static files. No build step, no database, no server-side code — it deploys
anywhere that can serve a directory.

### Railway

Already configured. `railway.json` pins the Docker builder and a healthcheck;
point a Railway service at this repository and it builds the `Dockerfile` and
serves it. Railway injects `$PORT` and the Caddyfile reads it, so there is
nothing else to set.

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
Cloud Run, a VPS or a laptop. Without Docker, any static file server works,
though the `Caddyfile`'s cache and error rules obviously will not apply:

```bash
python3 -m http.server 8000
```

### GitHub Pages

This is how the site actually publishes here. **Settings → Pages → Source must
be "GitHub Actions"**, not a branch: `.github/workflows/pages.yml` uploads the
tree as-is and deploys it on every push to `main`.

The branch source would run this past Jekyll, which has nothing to do — the
site is finished static files with no front matter, no Liquid and no theme —
and fails outright if the source folder is set to a directory that does not
exist. A root `.nojekyll` does not rescue that, because such a build never gets
far enough to read it. Putting the publishing configuration in a workflow keeps
it in the repository instead of in a settings dropdown.

## What's here

```
index.html                 the portfolio page
404.html                   self-contained error page — no external dependencies
assets/css/style.css       hand-written CSS: eight type tokens, two themes
assets/js/main.js          ~150 lines of vanilla JS, no libraries
assets/img/og.png          1200×630 link-preview card
assets/Preetam-Roy-CV.pdf  CV, two pages, without private contact details
demos/opslab/              live SLA breach scorer (bundled from its own repo)
demos/churn/               live churn scorer      (bundled from its own repo)
demos/digits/              live digit recogniser  (bundled from its own repo)
demos/traffic/             annotated playback     (bundled from its own repo)
Caddyfile                  static serving: compression, caching, headers, 404
Dockerfile                 caddy:2.11-alpine + the site
railway.json               Railway build and deploy config
render.yaml                Render Blueprint
```

The four demos are vendored copies of each project's own demo directory, so the
site has no external runtime dependency: every link on the page resolves within
this deployment. Their sources of truth remain
[Opslab](https://github.com/pr1317/opslab),
[customer-churn-analytics](https://github.com/pr1317/customer-churn-analytics),
[handwritten-digit-recognition](https://github.com/pr1317/handwritten-digit-recognition)
and [smart-traffic-management](https://github.com/pr1317/smart-traffic-management).

To refresh a demo, re-copy `docs/` from its repository. Opslab keeps its demo in
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
| [Opslab](https://github.com/pr1317/opslab) | Operations analytics for BFSI back-office processes — process mining, SPC, SLA survival analysis and a Power BI model linter, on the standard library alone | `/demos/opslab/` |
| [handwritten-digit-recognition](https://github.com/pr1317/handwritten-digit-recognition) | 98.48% on MNIST; the finding is that deskewing beats model choice | `/demos/digits/` |
| [customer-churn-analytics](https://github.com/pr1317/customer-churn-analytics) | ROC-AUC 0.846, and whether acting on the prediction pays for itself | `/demos/churn/` |
| [smart-traffic-management](https://github.com/pr1317/smart-traffic-management) | YOLOv4-tiny and a centroid tracker turning a highway camera into telemetry | `/demos/traffic/` |

## The design

Warm paper ground, a muted sage accent, Newsreader over Public Sans. Light is
the default; the dark theme keeps the same warm neutral rather than flipping to
a blue-black, so the two read as one site at different times of day, and the
accent lifts from `#7C9A84` to `#9DBCA4` to hold contrast on the dark ground.

**One role, one size.** Every `font-size` in the stylesheet is one of eight
`--fs-*` tokens — 53 declarations, no exceptions. That constraint is the whole
point: an earlier version of this stylesheet had drifted to 36 distinct sizes,
with card headings rendering at six different sizes despite sitting in the same
visual position.

**Phone first.** Most visitors arrive on a phone, so the small layout is not the
desktop one squeezed down. The headline, both buttons and the first two figures
all land above the fold; a docked Email/CV bar rises once the hero scrolls away,
where a thumb can reach it; the menu is a full screen rather than a dropdown;
and nothing tappable is under 44px.

## Notes on the build

- **No framework, no bundler, no tracking.** One HTML file, one stylesheet,
  ~150 lines of vanilla JS, and four vendored demos.
- **Responsive** from 320px up, checked for horizontal overflow and touch
  target size at eleven widths between 320 and 1920.
- **Themes.** The toggle persists a choice in `localStorage`, and every access
  is wrapped, so private browsing cannot break it. An inline script in `<head>`
  applies a stored theme before first paint — no flash of the wrong one.
- **Degrades safely.** Content is visible by default and only hidden for the
  entrance animation once the boot script runs, so a blocked or failed
  `main.js` cannot leave the page blank.
- **Motion** is position-triggered and fires once — header condense, staggered
  reveals, counters, bars drawing, scroll-spy nav. All of it collapses to a
  plain fade under `prefers-reduced-motion`.
- **The error page is self-contained** — inline CSS, no web font, no script.
  It is served at whatever wrong URL a visitor hit, so a relative asset path
  would resolve against *that* path and 404 in turn.
- **Print** produces a clean CV-style document.
- **Serving**: gzip/zstd compression (the stylesheet goes 23.7 KB → 5.9 KB),
  `no-cache` on HTML so a redeploy is visible immediately, longer caches on
  demo frames and model weights, and `nosniff` / `Referrer-Policy` /
  `X-Frame-Options` on everything.
- **Errors are never cached.** The cache rules match on the request path, so
  without an explicit `no-store` in `handle_errors` a transient 404 for the
  stylesheet — during a container swap, say — would be stored for an hour and
  the visitor would keep getting an unstyled page. The stylesheet and script
  also carry a `?v=` build stamp so a new deploy cannot be masked by a stale
  entry.

## A note on the numbers

Every figure on the page traces to a source, and links to it: the workplace
metrics link through to the role they came from, and each model figure links to
the repository that produces it.

Where a rounder number was available I used the defensible one instead. The
traffic project reports near-field recall rather than an overall "detection
accuracy", because the clip it runs on ships without labels and there is
nothing to measure such a figure against.

## The CV

`assets/Preetam-Roy-CV.pdf` is the public copy: two pages, A4, no phone number
and no certification ID numbers, because anything linked from a public page can
be downloaded and indexed by anyone. Issuers and dates remain.

The named systems in its TCS section — Agent Journey Mapping, the ID crosswalk
and performance flags, the DSAT allocation engine, the self-contained HTML
reporting — also appear on the page under that role, so the CV and the site say
the same thing about the same work.
