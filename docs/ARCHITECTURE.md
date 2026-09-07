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

Time is seconds relative to `startUtc`; coordinates are `[longitude, latitude]`. Synthetic segments may start before and finish after the displayed window. Observed compilation is cropped to its declared interval. The renderer never extrapolates before or after a segment and never connects separate segments. Dateline crossings interpolate along the short longitude path; a screen-edge crossing does not create a line across the entire map.

The canvas uses a simple equirectangular projection and repeats geometry at the world seam. Distortion at high latitudes is expected. This is not a navigational map. Pan is bounded; focal-region buttons and zoom/reset provide keyboard alternatives. Two touch pointers pan and zoom around their moving midpoint; lifting one finger rebases the remaining drag and never selects a vessel. Trackpad pinch uses non-passive Ctrl-wheel handling and Safari GestureEvents on the canvas, while ordinary wheel scrolling remains available to the page. Gesture changes stay within the same 1–10× zoom bounds as the buttons. The fixture routes are hand-authored schematic passages, not measured sea lanes.

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

Compiler output is always `review-required`, and the CLI refuses output under this repository’s `public/`. Classification is deliberately `other` until a time-aligned static-message adapter exists. Names, IMO history, self-reported fields, inferred port calls and cargo context are not implemented. A nine-digit MMSI format check does not validate actual identity allocation. Content hashes describe the normalized input, not an archived provider download; provider adapters must add raw-source/query provenance.

## Publication boundary

No observed track can enter this prototype merely by replacing the fixture: the client parser and build budget check enforce synthetic source metadata. Admission of real data requires a deliberate source-specific change, rights/provenance documentation and coverage tests. A source flag is an engineering gate, not evidence that a licence has been obtained. Downsampling alone is not proof that a track artifact is irreversible or non-reconstructable.

Presence grids describe intensity. They cannot be converted into moving hulls or directional voyages. `PresenceStudy` reserves a separate path; the current loader and renderer implement only synthetic `TrackStudy`.

## Initial budgets and remaining work

- Application JS/CSS: at most 150 KiB gzip.
- Initial world field plus land: at most 1.5 MiB gzip.
- No raw feed or provider credentials in the browser.
- CI tests cover playback limits, dateline interpolation, fixture admission, ordering, duplicates, conflicts, invalid reports, gap splitting, speed jumps and publication status.
- Gesture regression tests cover pointer sequences, anchored zoom, handoff to one-finger panning, cancellation, trackpad event handling and listener cleanup. Physical-device interaction and phone frame-rate measurements remain to be performed; bundle checks do not establish GPU/CPU performance.
- Spatial/time chunk loading, adaptive level of detail, port-call inference, provider adapters, static identity histories and trade statistics are next-stage work.

The source research remains in Motion Studies; `docs/STUDY.md` is a pinned copy so the new repository is understandable on its own. Catalogue admission and linking remain a separate editorial decision.

## Optional agent navigation

When a browser exposes `document.modelContext`, the page registers `navigate_manifest_study` to choose a focal region and demo day, pause playback and clear vessel selection using the same application state. Unsupported browsers are unaffected. The input validator is unit tested. Registration and end-to-end execution have not been verified in a supported WebMCP browser context; this optional integration is not a prerequisite for the human-facing prototype.
