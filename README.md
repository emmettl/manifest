# MANIFEST

**World trade in motion.** An independent, unnumbered Motion Studies investigation.

[Open the prototype](https://emmettl.github.io/manifest/) · [Study](docs/STUDY.md) · [Architecture](docs/ARCHITECTURE.md) · [Next steps](docs/ROADMAP.md)

The first version is a static, runnable ocean study with 420 deterministic synthetic vessels, cargo/tanker filters, world and regional views, pan/zoom (including touch and trackpad pinch), a 30-day playback clock, vessel inspection, a searchable catalogue of 135 major ports with labels at every demo destination, and source notes. Every vessel and trajectory is explicitly synthetic. Counts are fixture counts, routes are schematic, and the clock is illustrative. No AIS observations, vessel identities, cargo contents or trade volumes are represented.

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

Relative Vite asset paths support the `/manifest/` project URL. The public folder contains only the synthetic study, pinned Natural Earth land geometry and favicon. Raw provider data and local compilations belong in ignored `data/raw/` and `data/compiled/` directories.

## Evidence and next milestone

The regional compiler accepts normalized historical AIS reports, validates coordinates and identifiers, removes duplicates, rejects conflicting simultaneous positions, splits gaps and impossible jumps, and emits a source hash plus audit counts. Its output remains `review-required`; it does not authorize publication. The prototype loader admits only synthetic data.

The next milestone is one licensed regional observation fixture, a measured gap policy, and a source-approved publication path. Global presence grids and individual trajectories have distinct contracts. See the [architecture](docs/ARCHITECTURE.md) for limitations and the normalized input format.

Code: MIT. Generated fixture: CC0. Geography: public domain, [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/); pinned source and hashes are in [data provenance](docs/DATA-SOURCES.json). Fonts currently load from Google Fonts with local system fallbacks.

Port selection, aggregate-port mappings and geographic sources are documented in [PORTS.md](docs/PORTS.md).
