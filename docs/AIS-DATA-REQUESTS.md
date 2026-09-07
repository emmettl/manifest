# Prepared AIS data requests

Drafts prepared on 7 September 2026. Neither request has been sent. No account, contract or purchase has been initiated.

## NOAA publication-use clarification

Intended destination: NOAA Office for Coastal Management; the [dataset contact](https://www.fisheries.noaa.gov/inport/item/77594/full-list) lists `coastal.info@noaa.gov`.

Subject: Use of Marine Cadastre 2025 AIS in an attributed public visual study

Hello,

I am developing MANIFEST, an independent visual study of vessel movement. We have downloaded the 1–3 January 2025 daily AIS files from the NOAA archive and built a local evaluation covering the Los Angeles/Long Beach approaches (120–117°W, 32.5–34.5°N).

The proposed public work would replay received cargo/tanker vessel positions over those 72 hours, preserve reception gaps, and credit the U.S. Coast Guard Navigation Center, BOEM and NOAA Office for Coastal Management. It would make no claim about cargo contents or trade volumes. Vessel classes would be labelled as supplied by NOAA, including AVID enrichment.

The 2025 InPort metadata lists no access constraints and a use constraint of “For coastal and ocean planning.” Could you confirm the applicable terms for an independent public visual artwork, including hosting browser-readable derived track JSON on a static website? The JSON contains positions, timestamps and namespaced MMSIs and can be recovered by viewers; we are not relying on downsampling or presentation as a restriction on copying.

Please also clarify whether those terms cover keeping an archival copy and displaying screenshots, videos or exhibition captures, and whether AVID-enriched type information has any additional conditions. If another notice or permission governs this use, please direct us to it and to the required attribution.

The observations remain local pending this clarification. Thank you.

## Global historical AIS evaluation and quote

Intended destination: Kpler maritime data sales via its [AIS contact page](https://www.kpler.com/product/maritime/kplerais). This is one provider lead, not a supplier comparison. The earlier study's separate Spire lead is outdated: Spire's maritime business was acquired by Kpler ([Spire filing](https://ir.spire.com/sec-filings/all-sec-filings/content/0000950170-25-058698/0000950170-25-058698.pdf)).

Subject: Historical AIS evaluation for MANIFEST — 72-hour sample and 30-day public study

Hello,

I am developing MANIFEST, an independent authored web visualisation of global cargo and tanker movement. The intended work is a replay of a fixed historical interval, with observed gaps visible, rather than a live tracking service.

Could you quote a small evaluation and a subsequent 30-day global historical extract, including satellite and terrestrial observations? For a reproducible comparison with our regional proof, our preferred evaluation interval is 1–3 January 2025 UTC and our preferred full interval is 1–30 January 2025 UTC. If another interval offers materially better completeness or evaluation availability, please identify it and explain the difference.

For evaluation, we propose these bounding boxes, expressed as west/south/east/north longitude/latitude:

| Region | Bounds |
| --- | --- |
| Yangtze approaches | 120 / 29 / 124 / 33 |
| Pearl River approaches | 112 / 20 / 116 / 24 |
| Malacca and Singapore | 98 / -1 / 105 / 7 |
| Hormuz | 54 / 23 / 59 / 28 |
| Suez approaches | 31 / 27 / 35 / 32 |
| Bab el-Mandeb | 41 / 11 / 45 / 15 |

Please include MMSI, UTC observation and reception timestamps where available, longitude/latitude, speed/course, reception source type and relevant quality fields. Please identify downsampling, filtering and coverage limitations. We also need vessel-type and identity records with effective dates or a clear explanation of temporal validity. Please quote port calls and vessel characteristics separately.

For shipping-line attribution, please separately quote an IMO-keyed historical commercial-operator and parent-group mapping, including chartered vessels and subsidiaries. Our first focus is MSC, Maersk and CMA CGM, followed by COSCO, Hapag-Lloyd, ONE, Evergreen, HMM, Yang Ming and ZIM. Please distinguish the commercial operator from the registered owner, technical/ISM manager and cargo booking carrier. We need effective start/end dates, historical IMO–MMSI associations, source provenance, conflict/missing-data coverage, and rights to publish the resulting operator labels and group filters alongside derived tracks. A first evaluation should cover our existing 1–3 January 2025 LA/Long Beach sample; a current fleet snapshot would not establish attribution for those dates.

The key requirement is a permitted publication path: a static public website serving derived, browser-readable positions and track segments, potentially recoverable by visitors, plus screenshots/video and possible exhibition display. Please specify permitted identifiers, precision, time resolution, attribution, retention, hosting/CDN arrangements, audience restrictions, fees, and whether the fixed published artifact may remain available after the data subscription ends. Public GitHub storage of derived artifacts should be addressed separately from private raw-archive retention; if public file hosting is prohibited, please propose an approved delivery model.

Please separate evaluation pricing from full-window pricing and state any recurring charges or minimum commitment. We have not committed to a budget or subscription. We would like to evaluate actual data and the publication terms before choosing the production architecture.

Thank you.
