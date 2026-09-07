# Shipping-line attribution

The local NOAA review has MSC, Maersk and CMA CGM focus buttons, a ten-group selector, other verified operators and an explicit Unknown category. These are commercial-operator filters, not ship-name searches, ownership claims, cargo booking carriers or a live capacity ranking. The public synthetic study has no real-company assignments.

## Current evidence

The NOAA 2025 CSV includes `vessel_name` and `imo`. The adapter now preserves names and valid seven-digit IMO numbers (including check-digit validation) alongside MMSI. These remain source-supplied identities; a valid checksum is not independent hull verification. The local compiler also writes `data/compiled/noaa-la-2025.identities.json` as a research inventory, outside Git and public serving.

No verified historical operator registry is bundled. Research on 7 September 2026 found current vessel directories and carrier schedules, but did not establish commercial-operator validity for the exact 1–3 January 2025 sample. Names containing MSC, MAERSK or CMA CGM are insufficient evidence. Consequently the actual sample currently shows Unknown operators, and choosing a company produces an explicit empty state. Invented records in tests verify the complete matching/filtering path; they are never used in the actual sample.

References: [USCG AIS fields](https://www.navcen.uscg.gov/ais-class-a-reports), [IMO hull identification](https://www.imo.org/en/ourwork/iiis/pages/imo-identification-number-schemes.aspx), [Alphaliner operator/fleet information](https://public.axsmarine.com/alphaliner), [Alphaliner group consolidation](https://alphaliner.axsmarine.com/PublicTop100/). These establish the methodology and potential enrichment source, not individual historical assignments. The [prepared provider request](AIS-DATA-REQUESTS.md) now asks for historical commercial operators, group membership and publication rights. It has not been sent.

## Import a reviewed registry

Keep the registry at `data/raw/operators.json`. Its structure is `{"schemaVersion":1,"publication":"review-required","records":[]}`. Every record requires:

| Field | Meaning |
| --- | --- |
| `imo` | Seven-digit string with a valid checksum, independently checked against the evidence |
| `groupId` | `msc`, `maersk`, `cma-cgm`, `cosco`, `hapag-lloyd`, `one`, `evergreen`, `hmm`, `yang-ming`, `zim`, or `other` |
| `operatorName` | Actual commercial operator; preserve subsidiary name here and its dated parent group above |
| `role` | Exactly `commercial-operator` |
| `validFrom`, `validTo` | Explicit UTC instants in `YYYY-MM-DDTHH:mm:ssZ` form; inclusive start, exclusive end |
| `evidenceNote` | Why the evidence establishes the operator, hull, group and validity interval; identify the source page/record |
| `source.label`, `source.url`, `source.retrievedUtc` | Attributed source, HTTP(S) URL and retrieval instant in the same UTC format |

Entering a record asserts that its evidence has been reviewed. Structural validation cannot verify the truth of a source. Do not turn a current snapshot, a schedule selling slots, a technical manager or an owner record into an unsupported historical commercial-operator interval. Do not automatically extend a dated observation before/after its evidenced validity. Group consolidation must also apply at the historical date; there is no automatic alias inference.

```sh
npm run data:noaa -- --operators data/raw/operators.json
npm run dev
# Open /?study=noaa-la-2025 on the local development server.
```

An explicit registry is required on every compilation that uses enrichment. Omitting `--operators` compiles Unknown operators; it does not reuse an old registry silently. The generic `data:compile` command accepts the same registry as `operatorRegistry` in normalized input. Malformed records and overlapping intervals for a hull fail before compilation. Missing/invalid IMOs and out-of-validity records remain Unknown. There is no name, flag, destination or MMSI-prefix fallback.

The compiler creates separate vessel episodes and track segments when class, reported identity or operator evidence changes. It never joins across those boundaries, reception gaps, conflicting reports or exits from the region. The loader verifies that every attributed sample falls within its operator interval. Filters apply to the same study used by the map, trails, picking, active count and vessel selector, and changing filters clears selection. An episode's evidence is shown in vessel inspection even when playback moves into a reception gap; the UI labels it as evidence for that episode.

Audits include attributed/Unknown vessel-record counts, identity/operator splits and the registry SHA-256. Counts are episode records, not fleet size, market share or unique worldwide hull totals. Raw registries, identity inventories and compiled observed artifacts remain local and review-required. A publication path for both position and enrichment data is still required before release.
