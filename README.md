# MANIFEST

**World trade in motion.** An independent, unnumbered Motion Studies investigation.

[Open the prototype](https://emmettl.github.io/manifest/) · [Study](docs/STUDY.md) · [Architecture](docs/ARCHITECTURE.md) · [Next steps](docs/ROADMAP.md)

The first version is a static, runnable ocean study with 420 deterministic synthetic vessels, cargo/tanker filters, world and regional views, pan/zoom (including touch and trackpad pinch), a 30-day playback clock, vessel inspection, a visible search across 135 major ports, port hero cards, labels at every demo destination, and source notes. Every vessel and trajectory is explicitly synthetic. Counts are fixture counts, routes are schematic, and the clock is illustrative. The animation contains no AIS observations, real vessel identities, cargo contents or measured trade volumes. Port cards separately display attributed annual statistics and rankings for 52 ports; other ports have geographic profiles with an explicit missing-statistics state.

The prototype remains **unlinked from the Motion Studies catalogue** until it progresses. The page requests no indexing; the repository and Pages URL are public, so this is not access control.

## Development

Node 22.12 or later and npm:

```sh
npm ci
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
```

`npm run check` checks repository boundaries, runs the maritime contract/compiler tests, typechecks, builds the application, and enforces compressed payload budgets. `npm run data:demo` regenerates the exact committed fixture. Respect reduced-motion preferences: playback starts paused for those users. Scrubbing pauses the clock.

## Repository boundary

React, TypeScript and Vite. MANIFEST consumes the published `@motionstudies/web` package with an exact version pin for shared tokens and asset URL handling. The ocean canvas, maritime data contracts, compiler policy, fixture, composition, and styles live here. No sibling source imports or workspace links. The initial renderer uses Canvas 2D; a GPU field can replace it behind the maritime contracts when actual data establishes the need. The current rail-oriented shared scenes are not a maritime model.

## Publication

Every push to `main` runs the checks and deploys their exact `dist` artifact to GitHub Pages. Pull requests run the same checks without deployment. Six browser regressions check the built site’s desktop framing and canvas sizing before deployment. `Deploy Pages` can also be run manually. The repository’s Pages source must be **GitHub Actions**. No provider keys or deployment secrets are required; deployment uses the workflow’s Pages and OIDC permissions.

Relative Vite asset paths support the `/manifest/` project URL. Public movement data contains only the synthetic study, alongside pinned Natural Earth land and port geography. Raw provider data and local compilations belong in ignored `data/raw/` and `data/compiled/` directories.

## Local NOAA observation review

A real 72-hour LA/Long Beach sample is now supported alongside the public synthetic demo. It contains 84 NOAA cargo-class vessels, 29 tankers and 117,177 received positions from 1–3 January 2025. No positions are downsampled. See the [source, acquisition and quality notes](docs/NOAA-SAMPLE.md).

With Node and the `zstd` CLI installed:

```sh
# First acquisition: about 572 MB of compressed AIS plus detailed Natural Earth land.
npm run data:noaa -- --download
# Subsequent rebuilds use the retained archives and metadata, without network access.
npm run data:noaa
npm run dev
```

Open `http://127.0.0.1:5173/?study=noaa-la-2025` (or the port printed by Vite). The review starts paused, uses actual UTC dates and labels observed versus interpolated positions. A ten-minute maximum gap, speed checks, conflicts and observed exits break tracks. Vessel types are NOAA/AVID classifications; no historical hull-identity or cargo-content claim is made.

The local endpoints serve only the review tracks and regional land to loopback clients. Direct HTTP access to `data/raw/` and `data/compiled/` is denied. They are absent from production builds and `vite preview`; the default URL remains the synthetic study. Source metadata records an outstanding public-artwork use review. [Prepared external requests](docs/AIS-DATA-REQUESTS.md) have not been sent.

## Evidence and next milestone

The regional compiler accepts normalized historical AIS reports, validates coordinates and identifiers, removes duplicates, rejects conflicting simultaneous positions, splits gaps and impossible jumps, and emits a source hash plus audit counts. Its output remains `review-required`; it does not authorize publication. The prototype loader admits only synthetic data.

The regional observation sample and initial measured gap policy are available locally. The next milestone is a source-approved publication path and review of a selected voyage. Global presence grids and individual trajectories have distinct contracts. See the [architecture](docs/ARCHITECTURE.md) for limitations and the normalized input format.

Code: MIT. Generated fixture: CC0. Geography: public domain, [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/); pinned source and hashes are in [data provenance](docs/DATA-SOURCES.json). Fonts currently load from Google Fonts with local system fallbacks.

Port selection, aggregate-port mappings and geographic sources are documented in [PORTS.md](docs/PORTS.md).
