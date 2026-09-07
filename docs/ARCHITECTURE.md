# MANIFEST skeleton

The feasibility study is sufficient for a provider-independent prototype. This repository does not resolve the source-rights and coverage gates identified in that study.

## Layers

| Surface | Responsibility |
| --- | --- |
| `src/App.tsx` | Clock, chapter selection, visibility, evidence panel and data loading/retry |
| `src/components/OceanScene.tsx` | Land projection, pan/zoom, moving marks, fading trails and pointer selection |
| `src/maritime/types.ts` | Distinct track and presence contracts; evidence and publication metadata |
| `src/maritime/playback.ts` | Bounded segment interpolation and short-path longitude wrapping |
| `src/maritime/load.ts` | Runtime validation; synthetic-only public artifact gate |
| `scripts/generate-demo.mjs` | Seeded, reproducible illustrative fixture |
| `scripts/compile-ais.mjs` | Offline quality filtering and segmentation of normalized reports |
| `scripts/noaa-sample.mjs` | Fixed NOAA 2025 acquisition, checksums, two-pass regional adapter, classification episodes and quality audit |
| `scripts/local-noaa-plugin.mjs` | Dev-only loopback serving of two fixed local review artifacts |

Time is seconds relative to `startUtc`; coordinates are `[longitude, latitude]`. Synthetic segments may start before and finish after the displayed window. Observed compilation is cropped to its declared interval. The renderer never extrapolates before or after a segment and never connects separate segments. Dateline crossings interpolate along the short longitude path; a screen-edge crossing does not create a line across the entire map.

The canvas uses a simple equirectangular projection and repeats geometry at the world seam. The desktop opening uses the full browser width and fits both width and a 130-degree latitude band. This prevents repeated tiny worlds on wide windows and large empty polar areas on tall or 4K windows. On taller aspect ratios, the edges of the Pacific can fall outside the initial frame and remain accessible by panning. The page has no fixed maximum content width. A compact desktop shell gives the map the remaining window height, with a minimum canvas height and page scrolling on short windows. Mobile retains its previous overview scale and stacked layout. Projection scale is shared with gesture calculations. Distortion at high latitudes is expected. This is not a navigational map. Pan is bounded; focal-region buttons and zoom/reset provide keyboard alternatives. Two touch pointers pan and zoom around their moving midpoint; lifting one finger rebases the remaining drag and never selects a vessel. Trackpad pinch uses non-passive Ctrl-wheel handling and Safari GestureEvents on the canvas, while ordinary wheel scrolling remains available to the page. Gesture changes stay within the same 1–10× zoom bounds as the buttons. The fixture routes are hand-authored schematic passages, not measured sea lanes.

## Offline normalized input

Keep input outside `public/`, in ignored `data/raw/`:

```json
{
  "source": { "id": "provider-release", "label": "Dated regional source", "license": "Exact source terms / reference" },
  "startUtc": "2026-01-01T00:00:00Z",
  "duration": 86400,
  "reports": [
    { "mmsi": "123456789", "timestamp": 1767225600, "longitude": 4.0, "latitude": 52.0 }
  ]
}
```

`timestamp` is Unix seconds, not milliseconds. The example above illustrates the schema only.

```sh
npm run data:compile -- data/raw/normalized.json data/compiled/study.json
```

The compiler namespaces vessel IDs by source, rejects invalid/out-of-window records, sorts reports, deduplicates equal positions at the same time, and discards conflicting simultaneous positions while breaking the segment. Defaults split gaps over six hours and apparent speeds over 45 knots. These are provisional test thresholds, not validated provider-specific policy. They are recorded in the audit and configurable through the compiler function.

Compiler output is always `review-required`, and the CLI refuses output under this repository’s `public/`. Optional normalized `category` values (`cargo`, `tanker`, otherwise `other`) describe the provider's classification at the supplied row. A change creates a separate vessel-class episode and segment; a later class cannot be backfilled over earlier observations. Simultaneous class conflicts are discarded with a track break. This does not establish the historical validity of a provider's registry enrichment. Names, IMO history, inferred port calls and cargo context are not implemented. A nine-digit MMSI format check does not validate actual identity allocation. The compiler hash describes normalized input; the NOAA adapter additionally records original archive hashes, HTTP metadata, the source-page snapshot hash and selection bounds.

The optional compiler `bounds` are `[west, south, east, north]` and currently must not cross the dateline. Valid out-of-bounds reports flush a segment. The NOAA adapter first identifies in-region MMSIs, then retains those MMSIs' observations outside the region too, avoiding false continuity across observed exits and returns. The adapter reads the 2025 schema by header names, explicitly parses dates as UTC, rejects malformed CSV, preserves missing coordinates as invalid and maps only numeric 70–79 and 80–89 type codes. See `NOAA-SAMPLE.md` for measured limits. The generic six-hour default is unchanged; the NOAA adapter explicitly uses 600 seconds.

## Publication boundary

No observed track can enter the public prototype merely by replacing the fixture: the default client parser and build budget check enforce synthetic source metadata. The dev-only `?study=noaa-la-2025` path explicitly admits the pinned NOAA source with `review-required` status, starts paused, and requests only the two fixed loopback endpoints. The Vite plugin denies remote/cross-origin access and is absent from build/preview; Vite's static server also denies raw and compiled directories. The production check rejects additional `dist/data` files and retained local endpoint strings in application JS. Missing local data produces an error, never a synthetic fallback labelled observed.

Public admission still requires rights/provenance documentation and coverage tests. A source flag is an engineering gate, not evidence that a licence has been obtained. Downsampling alone is not proof that a track artifact is irreversible or non-reconstructable.

The review uses Natural Earth 1:10-million land polygons whose outer-ring bounds intersect a wider regional context box. Entire polygon rings and holes are retained; this is a selection, not a topological clip. It is regional context, not a complete detailed world map or harbour chart. Regional camera zoom extends to 320 using the same projection and gesture math; the synthetic view retains its 1–10 range. Review trails span 30 minutes (one hour when selected), and the entire 72-hour study plays in three minutes at 1×.

Presence grids describe intensity. They cannot be converted into moving hulls or directional voyages. `PresenceStudy` reserves a separate path; the current loader and renderer implement only synthetic `TrackStudy`.

## Initial budgets and remaining work

- Application JS/CSS: at most 150 KiB gzip.
- Initial world field plus land: at most 1.5 MiB gzip.
- No raw feed or provider credentials in the browser.
- CI tests cover playback limits, dateline interpolation, fixture admission, ordering, duplicates, conflicts, invalid reports, gap splitting, speed jumps and publication status.
- Gesture regression tests cover pointer sequences, anchored zoom, handoff to one-finger panning, cancellation, trackpad event handling and listener cleanup. Six Chromium browser checks exercise actual rendered land near the top of the map, visible playback controls, 1366×768 through 3840×2160 windows, a tall viewport, and high-density resizing during playback. Physical-device interaction and phone frame-rate measurements remain to be performed; bundle checks do not establish GPU/CPU performance.
- Spatial/time chunk loading, adaptive level of detail, port-call inference, provider adapters, static identity histories and trade statistics are next-stage work.

The source research remains in Motion Studies; `docs/STUDY.md` is a pinned copy so the new repository is understandable on its own. Catalogue admission and linking remain a separate editorial decision.

## Optional agent navigation

When a browser exposes `document.modelContext`, the page registers `navigate_manifest_study` to choose a focal region and demo day, pause playback and clear vessel selection using the same application state. Unsupported browsers are unaffected. The input validator is unit tested. Registration and end-to-end execution have not been verified in a supported WebMCP browser context; this optional integration is not a prerequisite for the human-facing prototype.

## Port labels

`public/data/ports.json` contains 135 ports and port-system representatives, covering all 50 systems in the WSC 2024 container-port baseline plus bulk, energy and regional gateways. The original nine Natural Earth markers retain their IDs and coordinates. `scripts/generate-demo.mjs` assigns origin/destination IDs and exact endpoints to synthetic segments; expanding the geographic layer does not add vessel calls. Selection, aggregate mappings and coordinate sources are documented in [PORTS.md](PORTS.md) and `DATA-SOURCES.json`.

Every visible port has an SVG marker and accessible name. Text labels avoid other labels, markers and main controls. Selected ports and demo voyage endpoints get priority; other names appear where space permits. The visible port combobox searches every port, including those outside the viewport, and centers/zooms the map on selection. Aliases cover aggregate and alternate names. Canvas tap hit-testing uses the same projected markers and label boxes as the overlay, preserving canvas ownership of pan and pinch gestures. Selected-port state is owned by App; the hero card replaces the chapter/vessel summary while a port is selected. Layout is memoized across playback frames. Published metrics come only from `port-statistics.json`, with explicit units, periods, scope and source links; missing figures remain absent. Statistics never depend on playback state. Passages remain separate from ports.

Tests verify exact demo endpoints, top-50 coverage, collision-free labels, geographic disambiguation and the ability to reveal any port at desktop and mobile sizes. Browser checks cover opening markers, China zoom, directory search, centering and keyboard focus. Set `MANIFEST_TEST_PORT` for a dedicated preview when another checkout is running.
