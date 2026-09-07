# Fleet-scale performance baseline

The default synthetic study contains **60,000 distinct vessels**, **60,000 independently timed voyage segments**, and **1,088,589 route samples**. This is an engineering workload for the estimated cargo/tanker scope, not a measured census or an AIS recording. All vessel identities, schedules and movements are invented.

Every voyage intersects the 30-day interval. Starts are staggered across each voyage's duration plus the study window, maintaining more than 20,000 concurrent positions at the beginning, opening and end of the study. At the paused opening (day 11, 12:00 demo UTC), 24,406 vessels have positions, including 17,400 cargo vessels. The other fleet members are outside their voyage segments at that time. Their absence is an authored timing choice, not evidence about real reception or the share of ships underway.

The generator retains the seven schematic corridors and sparse route vertices. It concentrates traffic heavily and makes wakes overlap into bright lanes. This exercises overdraw but does not reproduce realistic worldwide geography, speed distributions, stationary ships, message cadence, reception gaps or the hundreds of millions of samples in a month of AIS. It also does **not** establish performance at 60,000 simultaneously visible unique vessels. A future GPU stress test should include 60,000 and 100,000 concurrent marks as separate workloads.

## What the display measures

- **Vessels with positions:** unique fleet members inside a track segment at the clock time and allowed by the class filters. This count is independent of the camera.
- **Full study:** the complete 60,000-vessel catalogue. Movement samples load by day; this is not a multiplier applied to a small rendered dataset.
- **Data delivery:** current day, completed cached chunks (maximum two), their decoded JSON byte lengths, and the latest fetch/integrity/decode/validation time. This excludes catalogue bytes and is not a JavaScript heap measurement. Resident sample counts are also recorded by the browser benchmark.
- **Marks drawn:** Canvas submissions after viewport-margin culling. This includes repeated world copies and marks within the 100-pixel clipping margin; it can exceed the unique active count, especially in the phone overview.
- **Draw milliseconds:** elapsed CPU time in the Canvas drawing effect, including current-position and wake lookup, canvas reset, backdrop copy, and hit collection. During playback the meter reports the 95th percentile over approximately one second. Paused draws report their individual duration and exclude idle time.
- **Canvas draws per second:** completed drawing effects per elapsed second, not a claim about presented GPU frames. It includes pauses caused by surrounding main-thread work. The 16.7 ms / 60 fps target covers the whole frame: React work, geometry backdrop rebuilding, browser painting, data loading and GPU completion are not included in the draw-duration measurement.

The baseline retains all qualifying marks and the existing 24-stroke wakes. It does not silently thin the fleet, shorten trails, lower resolution or skip expensive work to meet the target. The vessel picker offers the first 100 matching active vessels, with label/ID search and map selection retaining access to every active vessel; it avoids creating tens of thousands of native option elements every frame.

## Loading budget

The previous monolithic baseline fetched **60.02 MiB decoded / 11.18 MiB gzip** of field data and geography. The default now uses a manifest, a catalogue and 30 daily track chunks. Paused opening loads only day 11; playback prefetches day 12. A scrub requests its destination day directly. Eviction limits the cache to the current and next day. Source-bound content hashes and decoded byte lengths are checked before decoding/admission.

| Delivery measure | Chunked fixture |
| --- | ---: |
| Worst first view: manifest, geography, catalogue and one day | 1.72 MiB gzip |
| Largest individual day | 1.31 MiB gzip |
| Catalogue plus two largest daily chunks | 13.25 MiB decoded JSON |
| Opening day alone | 4,285,966 decoded bytes / 123,145 samples |
| Full archive, including repeated wake overlap | 39.30 MiB gzip |
| Application JS/CSS | About 82.8 KiB gzip |

The full archive grows because every day independently carries the samples needed for a three-day selected wake. The browser does not download that archive upfront. Every active vessel and existing wake still renders. Original samples bracketing each window are preserved; daily ownership never becomes a reception gap or joins separate segments.

Build gates are now 150 KiB gzip for the app, 2 MiB gzip for the worst first view, 1.5 MiB gzip per daily chunk, 8 MiB decoded per asset, and 24 MiB decoded JSON for the catalogue plus two days. The remaining **15% overage** against the original 1.5 MiB first-view target is reported explicitly. Gzip sizes are computed by the build check, not inferred from loopback transfer encoding. Decoded JSON byte counts exclude object expansion, temporary decoding allocations and graphics memory. They are not a heap cap.

## Reproducing the measurements

```sh
npm run check
npm run benchmark
```

Set `MANIFEST_TEST_PORT` to use an unused loopback port; the local review server uses the next port. `benchmark` runs one Chromium worker so parallel tests do not compete with the timed workload. It loads the built site, measures five seconds of playback, then checks pan, zoom and scrubbing. Timing JSON and screenshots are written under `test-results/`. `npm run test:e2e` also covers these cases, but its parallel timing results should not be used as the serial baseline.

Monolithic baseline recorded 7 September 2026 on this macOS 26.6.2 arm64 host, using Playwright Chromium at device pixel ratio 1:

| Viewport | Opening marks submitted | Navigation to first-draw check | Canvas draws/s | p95 Canvas draw | p95 observed frame interval |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop, 1920 × 1080 | 25,474 | 1.86 s | 4.25 | 219.0 ms | 235.6 ms |
| Phone layout, 390 × 844 | 35,138 | 1.85 s | 3.82 | 249.6 ms | 263.0 ms |

Loading was over loopback, without network throttling. The navigation measurement includes browser/test scheduling and waiting for the first completed draw. The phone viewport is desktop emulation, not a physical-device measurement. Frame intervals are sampled through `requestAnimationFrame` when the canvas frame counter changes; they are an observed browser cadence, not a GPU timing query.

Both layouts exceed the drawing budget before accounting for the rest of the frame. This establishes that the current Canvas 2D implementation is unsuitable for fluid full-fleet playback. Daily chunk delivery now reduces loading and the resident history; the next rendering work is a GPU field with bounded trail work, followed by physical-device testing and spatial subdivision. These baseline numbers should remain visible when comparing that implementation.

## Chunking verification

The first parallel browser regression run with chunking opened the desktop view in 1.07 s and the phone viewport in 0.99 s over loopback, with one cached daily chunk containing 123,145 samples. Both retained exactly the baseline's opening vessel/mark counts. Drawing remained roughly 4–5 canvas draws/s, confirming that chunking improves delivery without resolving the Canvas wake bottleneck. These timings were collected with two browser test workers and are not a controlled serial speedup comparison.

Automated checks cover original-vs-chunk position/wake equivalence, real gap preservation, daily/dateline boundaries, malformed or mismatched assets, SHA-256 and byte validation, direct seeks, prefetch reuse, the two-chunk bound, cancellation despite late responses, and retry without reloading the catalogue. Browser measurements include delivery state alongside rendering data. Spatial subdivision and real AIS sample density remain separate work.
