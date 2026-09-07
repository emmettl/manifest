# Fleet-scale rendering performance

The default synthetic study contains **60,000 distinct vessels**, **60,000 independently timed voyage segments**, and **1,088,589 route samples**. This is an engineering workload for the estimated cargo/tanker scope, not a measured census or an AIS recording. All vessel identities, schedules and movements are invented.

Every voyage intersects the 30-day interval. Starts are staggered across each voyage's duration plus the study window, maintaining more than 20,000 concurrent positions at the beginning, opening and end of the study. At the paused opening (day 11, 12:00 demo UTC), 24,406 vessels have positions, including 17,400 cargo vessels. The other fleet members are outside their voyage segments at that time. Their absence is an authored timing choice, not evidence about real reception or the share of ships underway.

The generator retains the seven schematic corridors and sparse route vertices. It concentrates traffic heavily and makes wakes overlap into bright lanes. This exercises overdraw but does not reproduce realistic worldwide geography, speed distributions, stationary ships, message cadence, reception gaps or the hundreds of millions of samples in a month of AIS. It also does **not** establish performance at 60,000 simultaneously visible unique vessels. A separate GPU stress test should include 60,000 and 100,000 concurrent marks as separate workloads.

## What the display measures

- **Vessels with positions:** unique fleet members inside a track segment at the clock time and allowed by the class filters. This count is independent of the camera.
- **Full study:** the complete 60,000-vessel catalogue. Movement samples load by day; this is not a multiplier applied to a small rendered dataset.
- **Data delivery:** current day, completed cached chunks (maximum two), their decoded JSON byte lengths, and the latest fetch/integrity/decode/validation time. This excludes catalogue bytes and is not a JavaScript heap measurement. Resident sample counts are also recorded by the browser benchmark.
- **Marks drawn:** renderer submissions after viewport-margin culling. This includes repeated world copies and marks within the 100-pixel clipping margin; it can exceed the unique active count, especially in the phone overview.
- **CPU milliseconds:** elapsed preparation/submission time in the drawing effect, including head interpolation, texture updates and WebGL commands (or batched Canvas fallback). During playback the meter reports the 95th percentile over approximately one second. Paused draws report their individual duration and exclude idle time. This is **not GPU completion time**.
- **Draws per second:** completed drawing effects per elapsed second, not a claim about presented GPU frames. It includes pauses caused by surrounding main-thread work. The 16.7 ms / 60 fps target covers the whole frame: React work, geometry backdrop rebuilding, browser painting, data loading and GPU completion are not included in the draw-duration measurement.

Both renderers retain all qualifying marks, the full wake durations and the same device-pixel-ratio cap of two. WebGL draws original sample edges with continuous time-based fading, replacing the baseline’s 24 separately stroked resampled pieces. The Canvas fallback uses the same original edges with 16 fade buckets. Neither path thins vessels or shortens wakes. The visual change is explicit: continuous fading and original route corners replace the old stepped fades and occasional chords across those corners. The vessel picker offers the first 100 matching active vessels, with label/ID search and map selection retaining access to every active vessel; it avoids creating tens of thousands of native option elements every frame.

## Loading budget

The previous monolithic baseline fetched **60.02 MiB decoded / 11.18 MiB gzip** of field data and geography. The default now uses a manifest, a catalogue and 30 daily track chunks. Paused opening loads only day 11; playback prefetches day 12. A scrub requests its destination day directly. Eviction limits the cache to the current and next day. Source-bound content hashes and decoded byte lengths are checked before decoding/admission.

| Delivery measure | Chunked fixture |
| --- | ---: |
| Worst first view: manifest, geography, catalogue and one day | 1.72 MiB gzip |
| Largest individual day | 1.31 MiB gzip |
| Catalogue plus two largest daily chunks | 13.25 MiB decoded JSON |
| Opening day alone | 4,285,966 decoded bytes / 123,145 samples |
| Full archive, including repeated wake overlap | 39.30 MiB gzip |
| Application JS/CSS | About 86.7 KiB gzip |

The full archive grows because every day independently carries the samples needed for a three-day selected wake. The browser does not download that archive upfront. Every active vessel and existing wake still renders. Original samples bracketing each window are preserved; daily ownership never becomes a reception gap or joins separate segments.

Build gates are now 150 KiB gzip for the app, 2 MiB gzip for the worst first view, 1.5 MiB gzip per daily chunk, 8 MiB decoded per asset, and 24 MiB decoded JSON for the catalogue plus two days. The remaining **15% overage** against the original 1.5 MiB first-view target is reported explicitly. Gzip sizes are computed by the build check, not inferred from loopback transfer encoding. Decoded JSON byte counts exclude object expansion, temporary decoding allocations and graphics memory. They are not a heap cap.

## Reproducing the measurements

```sh
npm run check
npm run benchmark
```

Set `MANIFEST_TEST_PORT` to use an unused loopback port; the local review server uses the next port. `benchmark` runs one Chromium worker so parallel tests do not compete with the timed workload. On macOS outside CI, Playwright explicitly selects ANGLE Metal to exercise the physical GPU. CI uses its default backend. Every report identifies both the chosen renderer and backend; SwiftShader results must not be presented as hardware GPU measurements. It loads the built site, measures five seconds of playback, then checks pan, zoom and scrubbing. Timing JSON and screenshots are written under `test-results/`. `npm run test:e2e` also covers these cases, but its parallel timing results should not be used as the serial baseline.

Monolithic baseline recorded 7 September 2026 on this macOS 26.6.2 arm64 host, using Playwright Chromium at device pixel ratio 1:

| Viewport | Opening marks submitted | Navigation to first-draw check | Canvas draws/s | p95 Canvas draw | p95 observed frame interval |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop, 1920 × 1080 | 25,474 | 1.86 s | 4.25 | 219.0 ms | 235.6 ms |
| Phone layout, 390 × 844 | 35,138 | 1.85 s | 3.82 | 249.6 ms | 263.0 ms |

Loading was over loopback, without network throttling. The navigation measurement includes browser/test scheduling and waiting for the first completed draw. The phone viewport is desktop emulation, not a physical-device measurement. Frame intervals are sampled through `requestAnimationFrame` when the canvas frame counter changes; they are an observed browser cadence, not a GPU timing query.

Both baseline layouts exceeded the drawing budget before accounting for the rest of the frame. This established that the original per-stroke Canvas 2D implementation was unsuitable for fluid full-fleet playback. Daily chunk delivery reduced loading and the resident history; the GPU implementation below addresses rendering. These baseline numbers should remain visible when comparing that implementation.

## Chunking verification

The first parallel browser regression run with chunking opened the desktop view in 1.07 s and the phone viewport in 0.99 s over loopback, with one cached daily chunk containing 123,145 samples. Both retained exactly the baseline's opening vessel/mark counts. Drawing remained roughly 4–5 canvas draws/s, confirming that chunking improves delivery without resolving the Canvas wake bottleneck. These timings were collected with two browser test workers and are not a controlled serial speedup comparison.

Automated checks cover original-vs-chunk position/wake equivalence, real gap preservation, daily/dateline boundaries, malformed or mismatched assets, SHA-256 and byte validation, direct seeks, prefetch reuse, the two-chunk bound, cancellation despite late responses, and retry without reloading the catalogue. Browser measurements include delivery state alongside rendering data. Spatial subdivision and real AIS sample density remain separate work.


## Resident GPU renderer (7 September 2026)

`fleet-webgl.ts` submits six draw calls: one instanced edge pass and one point pass for each of three wrapped world copies. Original sample edges are packed and uploaded once per resident day, with explicit dateline splits and logical segment indices. Each frame updates a reusable head texture and time/camera/selection uniforms. The shader clips each edge to the full wake interval and fades by age. An inactive head suppresses its entire wake, so reception gaps remain empty. Static land stays in a separate cached Canvas layer. Picking computes the nearest current mark only on interaction.

The study clock commits its React update inside the animation callback, cancelling the outgoing callback when a daily transition replaces its effect. Deferring that commit through React’s normal scheduler was reducing the first GPU version to roughly 30 draws/s despite a roughly 2 ms submission time. This change restores the browser’s approximately 60 Hz cadence without advancing through background-tab time.

For a like-for-like baseline, commit `cd9abf5` was built separately and benchmarked with **ANGLE Metal / Apple M4 Max**, the same Chromium, fixture and serial test procedure used for the replacement:

| Original Canvas on Metal | Opening marks | Navigation to first-draw check | Draws/s | p95 CPU draw | p95 observed frame interval |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop, 1920 × 1080 | 25,474 | 0.83 s | 7.88 | 130.7 ms | 160.0 ms |
| Phone layout, 390 × 844 | 35,138 | 0.84 s | 6.60 | 164.0 ms | 194.9 ms |

This baseline is faster than the earlier default-headless Canvas measurements above. Backend choice therefore remains explicit in the comparison. The replacement on the same hardware measured:

| Viewport | Opening marks | Navigation to first-draw check | Draws/s | p95 CPU submission | p95 observed frame interval |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop, 1920 × 1080 | 25,474 | 0.39 s | 58.93 | 2.0 ms | 17.7 ms |
| Phone layout, 390 × 844 | 35,138 | 0.40 s | 59.12 | 2.0 ms | 18.7 ms |

The fixture, class filters and opening count of 24,406 active unique vessels are unchanged. This is approximately 60 draws/s on this desktop GPU, **not a claim of 60 fps on phones or a strict 16.7 ms p95 frame pass**. The measured p95 observed interval still exceeds 16.7 ms; the benchmark reports that separately from CPU submission. No GPU timing query or physical-phone measurement has been made. Current GPU edge/head buffers are approximately 3.03 MiB for the measured day, excluding render targets, driver allocations and CPU objects. Five seconds of playback crosses a daily boundary and uploads geometry twice, not once per frame.

In the parallel CI-mode regression run, the batched fallback measured 24.4 draws/s at desktop size and 18.6 in the phone layout (7.2/8.7 ms p95 CPU preparation). These are software/backend regression observations, not a serial comparison with the GPU table.

The default headless Chromium backend on this host was SwiftShader. Running the same WebGL field there produced only about 0.35 draws/s despite roughly 2 ms CPU submission. The app detects known software rasterizers and uses the batched Canvas fallback; unsupported WebGL and context loss also retain an interactive Canvas map. Context restoration rebuilds GPU resources from the current chunk. The readout names the renderer and flags either excessive CPU duration or sustained cadence below 55 draws/s. Software-rendering performance is not a substitute for physical-device testing.

Regression coverage includes rendered GPU pixels through reception gaps, map picking, shader errors, fixed draw-call and buffer bounds, geometry reuse through playback, high-density resizing, and Canvas fallback/GPU recovery after context loss. The tiny shader contract test deliberately exercises WebGL even on CI’s software backend; the fleet-scale CI workload uses the production fallback policy.
