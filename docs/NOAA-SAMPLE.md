# NOAA regional observation sample

Acquired and reviewed locally on 7 September 2026. This is a reproducible engineering/evidence proof; all provider observations and derived tracks remain ignored local files with `review-required` status.

## Source and scope

[Nationwide Automatic Identification System 2025, NOAA InPort 77594](https://www.fisheries.noaa.gov/inport/item/77594/full-list), Office for Coastal Management, published 22 January 2026; metadata updated 27 August 2026. Credit: U.S. Coast Guard Navigation Center, Bureau of Ocean Energy Management, NOAA Office for Coastal Management.

The [daily archive index](https://noaaocm.blob.core.windows.net/ais/csv2/csv2025/index.html) supplies the three files below. The fixed study interval is `[2025-01-01T00:00:00Z, 2025-01-04T00:00:00Z)`. Region: 120–117°W, 32.5–34.5°N, covering LA/Long Beach and the surrounding approaches. This holiday interval is not a typical-traffic baseline. No API key or account was needed.

| Archive | Compressed bytes | SHA-256 |
| --- | ---: | --- |
| `ais-2025-01-01.csv.zst` | 202,190,247 | `36c07f4abad24f86fdd2ae8722b5a1d9422f3a223efc3482a568665275bdde53` |
| `ais-2025-01-02.csv.zst` | 186,214,844 | `9a82be237a58e4be26b0919ab5caa18fa40a092b55279e4605a9b13359fe33ee` |
| `ais-2025-01-03.csv.zst` | 183,328,957 | `08798d9069e41ee8527f8d320054b99b03b89ee69d2b660b6c5272d82480f002` |

All three responses have a 24 March 2026 Last-Modified date. Content-Length and Content-MD5 were checked; SHA-256 and ETag are retained in the local audit. The metadata-page snapshot SHA-256 is `935639de228ec151a636fd9412ba6a27830668290de2b9cc630defcaa25da563`.

NOAA documents one-minute source filtering, but the delivered regional cadence is often longer. It also documents enrichment of vessel type and identity fields using AVID. We use per-row `vessel_type` for broad class only, without assuming the enrichment is historically time-valid. Codes 70–79 are cargo, 80–89 tanker; missing or other codes remain other. Names, IMO, cargo codes, destination, draught and cargo contents are not used.

## Acquisition and regeneration

Prerequisites: project Node/npm installation and the `zstd` CLI on PATH. No new JavaScript runtime dependency is needed. Compressed AIS downloads total 571,734,048 bytes; allow roughly 1 GB for archives, normalized input, the full regional compilation and review artifacts. Normalization is streamed, with a second pass to preserve out-of-region observations of the selected cohort.

```sh
npm run data:noaa -- --download
npm run data:noaa
npm run dev -- --port 4187
```

Open `http://127.0.0.1:4187/?study=noaa-la-2025`. The default URL remains synthetic. With existing downloads, regeneration requires no network. `--download` acquires missing archives and land geometry and refreshes the metadata snapshot; a changed upstream file or metadata snapshot must be reviewed against this record. Interrupted downloads retain a `.partial` file and are not accepted as complete archives.

Local files:

- `data/raw/noaa-2025/`: original archives, HTTP headers, metadata snapshot, detailed land and normalized input.
- `data/compiled/noaa-la-2025.full.json`: all accepted regional classes.
- `data/compiled/noaa-la-2025.json`: cargo/tanker display selection, retaining every accepted sample.
- `data/compiled/noaa-la-2025.audit.json`: source manifest, whole-cohort quality audit, selected-cohort quality audit and display-selection counts.
- `data/compiled/noaa-la-land.geojson` and `.source.json`: detailed regional context and provenance.

## Measured result

| Measure | Result |
| --- | ---: |
| Daily records scanned | 20,606,864 |
| In-region input records | 1,317,000 |
| MMSIs observed in region | 1,591 |
| Cohort records including outside-region positions | 1,457,201 |
| Accepted in-region samples, all classes | 1,316,725 |
| Cargo / tanker / other vessel records | 84 / 29 / 1,478 |
| Displayed cargo/tanker samples | 117,177 |
| Displayed cargo/tanker segments | 2,121 |
| Review tracks, compressed with gzip | approximately 925 KiB |

Counts include stationary observations. Active marks mean vessels with an accepted segment at the clock time, not vessels under way or a census of the viewport. Sample IDs are namespaced MMSIs, not verified durable hull identities.

| Quality measure | All regional classes | Cargo/tanker MMSI cohort |
| --- | ---: | ---: |
| Identical duplicate reports removed | 264 | 43 |
| Simultaneous conflicting reports discarded | 94 | 46 |
| Gap breaks above 600 seconds | 36,595 | 1,092 |
| Speed breaks above 45 knots within gap cap | 164 | 7 |
| Median interval, seconds | 180 | 179 |
| 95th-percentile interval, seconds | 533 | 211 |
| 99th-percentile interval, seconds | 903 | 544 |

The gap distribution excludes simultaneous conflicts and intervals interrupted by an observed out-of-box position. It includes intervals that will subsequently be split by the quality thresholds. The displayed cohort's 99th percentile is about nine minutes; ten minutes is an initial editorial cap, not proof of continuous reception or a universal AIS policy. A five-minute cap would split 5,405 intervals in that cohort; ten minutes splits 1,092. Retain this comparison when adjusting playback.

Tracks break at conflicting simultaneous reports, observed exits, gaps above ten minutes, apparent jumps above 45 knots, and supplied class changes. No class changes occurred in this interval. Singleton segments appear only at their received time; there is no extrapolation before/after segments. Even a short accepted interpolation is inferred between observations; the inspection panel distinguishes it from an exact sample. All 117,177 display samples were checked against region and interval bounds; no accepted within-segment interval exceeds 600 seconds.

## Geography

[Natural Earth 1:10-million land](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-land/), from the [v5.1.2 GeoJSON](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_land.geojson), [public domain](https://www.naturalearthdata.com/about/terms-of-use/). Input SHA-256: `1ac90796408bc6ad6911d69448485d3c4dbf2190370080368a09976e1c9f7416`. Output SHA-256: `9eb85ebbab6abba18d56272f65270dfec7d138b353bb31f7c13c0debcfa9323f`.

Whole polygons intersecting the context bounds 123–115°W, 30–37°N are selected by outer-ring bounds; coordinates and holes are unchanged. Mainland polygons extend beyond the context box. Small harbour structures remain generalized. This is regional visual context, not navigation geometry or evidence for a port call.

## Publication path still to resolve

NOAA's metadata reports access constraints as “None” and use constraints as “For coastal and ocean planning.” That establishes access, but this record does not interpret it as an explicit grant to distribute this artwork's vessel-track JSON. The linked distribution disclaimer and intended public-artwork use need clarification or a documented applicable permission before a public observed fixture is admitted.

The concrete proposed release is a static, attributed 72-hour cargo/tanker study. Its client-readable positions may be recoverable; describe that honestly in a permissions request. The [prepared request](AIS-DATA-REQUESTS.md) asks about derived-file hosting, retention and captures. No request has been sent, no paid service ordered, and no data published. Regional compilation remains useful locally while that external step is unresolved.

Public movement data still contains only the synthetic fixture, alongside the published Natural Earth land and port context. The local review endpoint cannot be enabled by adding the query parameter to the deployed site. Tests cover parser admission, CSV/null/date handling, class changes, reception gaps, regional exits, UI evidence labels, mobile layout, missing-data behavior and static/cross-origin access denial.
