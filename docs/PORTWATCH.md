# PortWatch — first historical study

Implemented 18 September 2026. MANIFEST now has a local, source-backed port and passage study independent of global individual-vessel AIS procurement. This is the active direction selected by the author. The synthetic fleet and NOAA review remain available; the public build still serves the synthetic prototype.

## Open and reproduce

```sh
npm run data:portwatch
npm run dev -- --port 4193
# Open http://127.0.0.1:4193/?study=portwatch

# Recompile identical captured response bodies without contacting the provider:
npm run data:portwatch:offline
```

The first command makes a bounded acquisition, not a continuous recording. It needs outbound HTTPS but no API key. Raw response envelopes are ignored under `data/raw/portwatch-2023-2024/`; compiled output is ignored under `data/compiled/portwatch-study.json`. The dev server exposes only that fixed compiled artifact on loopback. The dynamic review import and endpoint are absent from production builds. No automatic publication or catalogue admission is implied.

## Authored interval and locations

**1 November 2023–31 March 2024, inclusive: 152 daily UTC bins.** The opening is 31 January 2024 and playback is initially paused. A seven-day trailing mean and a November daily baseline make the change readable while retaining individual daily values.

Passages: Suez Canal, Bab el-Mandeb Strait, Cape of Good Hope, Panama Canal, Malacca Strait, Strait of Hormuz, Gibraltar Strait and Dover Strait. Ports: Shanghai, Singapore, Rotterdam, Jebel Ali, Port Said, Durban, Colombo and Santos. Source location IDs and coordinates come from PortWatch's location databases. These are selected locations, not global coverage.

The opening three charts compare Suez, Bab el-Mandeb and the Cape. Ports have a separate view, with Shanghai, Singapore and Rotterdam as contextual charts. No port-to-port links or vessel trajectories are inferred.

## Sources and terms

- [Daily ports dataset](https://portwatch.imf.org/datasets/83b1bbc7b3354c5fb1f40673bb8f852e/about): `Daily_Ports_Data`, item `83b1bbc7b3354c5fb1f40673bb8f852e`.
- [Daily chokepoints dataset](https://portwatch.imf.org/datasets/3da2b9ca97684916b75c4013f95d18ab/about): `Daily_Chokepoints_Data`, item `3da2b9ca97684916b75c4013f95d18ab`.
- Location services: `PortWatch_ports_database` and `PortWatch_chokepoints_database` under the same [ArcGIS service root](https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services).
- [IMF statistical data terms](https://www.imf.org/en/about/copyright-and-terms), linked by the daily dataset item metadata. The statistical-data section permits downloading, transformation and distribution with accurate attribution and disclosure of material transformations; the page separately requests permission for potential commercial reuse. This is a local research implementation, not a determination of exhibition/commercial rights or access to raw upstream AIS.

Dataset-specific attribution is retained in the artifact and interface: **Sources: UN Global Platform; IMF PortWatch (portwatch.imf.org).** No third-party raw AIS rights are assumed. The locally retained item descriptions document the source definitions. A public release should retain these terms, attribution and transformation notices and decide its actual usage context before admitting the observed artifact.

## Contract and interpretation

The independent `portwatch-activity` contract cannot be loaded as a vessel-track study. All six category columns are retained: provider total, container, dry bulk, general cargo, ro-ro and tanker. Overlapping `cargo` subtotals are not added to provider totals.

| Measure | Source fields | Meaning |
| --- | --- | --- |
| Port calls | `portcalls`, `portcalls_<class>` | AIS-derived entries, subject to PortWatch visit filters; not unique ships or departures. |
| Port imports / exports | `import`, `export` and class variants | Estimated metric tonnes based on vessel/payload information; not customs records or observed manifests. |
| Passage transits | `n_total`, `n_<class>` | Daily vessel transits through each passage, both directions combined. |
| Passage volume | `capacity`, `capacity_<class>` | Estimated transit trade volume in metric tonnes, following the dataset's published variable definitions. |

No totals combine ports with passages, or different passages, because vessels can be counted repeatedly. Map circle area is proportional to the selected daily measure with one fixed full-period maximum across the displayed location set; a small centre marker keeps zero/missing locations selectable. Missing values are hollow/dashed. Charts have separate, disclosed vertical scales. Ship-class and measure changes may change scale; date changes do not.

The trailing mean requires all seven days. The November baseline requires all 30 days; missing measurements propagate, and a zero baseline has no percentage change. Chart paths break at missing values. Dates are consecutive calendar days including 29 February 2024. The interface does not interpolate daily counts into intraday evidence.

## First acquisition evidence

Captured 17 September 2026 UTC (18 September locally). **2,432 of 2,432 location-days present**, zero missing days and zero null metric cells. Compiled artifact: **238,760 bytes / 80,280 bytes gzip** at first acquisition. Source requests, retrieval times and SHA-256 hashes of exact response bodies are retained with the artifact; offline replay verifies hashes and query identity. Provider revisions remain possible on a new online capture.

| Passage | November 2023 mean transits/day | January 2024 | March 2024 |
| --- | ---: | ---: | ---: |
| Suez Canal | 76.57 | 48.03 | 38.87 |
| Bab el-Mandeb Strait | 77.33 | 39.42 | 32.61 |
| Cape of Good Hope | 49.27 | 72.19 | 85.94 |

These are descriptive monthly means calculated from the retained daily series. They are consistent with changed use of the passages, but do not match individual diverted voyages or establish causality.

## Verification

The compiler rejects duplicate location-days, out-of-scope records, changed required fields, negative/nonfinite values and invalid count types. Network queries have explicit date/location bounds, timeout, pagination ordering and a page ceiling. Offline regeneration is verified. Unit tests cover missing versus zero, leap day, scope/duplicate rejection, overlapping subtotals, seven-day completeness, zero baselines and chart gaps. Browser tests cover desktop/phone layouts, category and measure switching, missing data, source dialog and load retry using invented fixtures rather than provider downloads.

Validation passed: `npm run check` (75 unit tests, typecheck, production build and publication/bundle boundaries), offline regeneration, and the full browser suite (35 checks, including playback termination and the PortWatch production exclusion). Browser checks used `MANIFEST_TEST_PORT=4391` because an unrelated local service occupies the default port. Desktop and 390px phone layouts were inspected; phone checks are viewport emulation, not a physical-device benchmark.

The next artistic decision is whether this port-and-passage composition should replace the public synthetic fleet. Broader coverage and an authored historical narrative can follow the same aggregate contract; global raw AIS is not a prerequisite.
