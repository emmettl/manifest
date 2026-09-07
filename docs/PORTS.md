# Major-port catalogue

The map contains 135 named ports and port-system representatives. Coverage is a curated geographic layer, not a claim that each port has traffic in the current vessel dataset, nor a universal ranking of all maritime activity.

## Selection

- All 50 port systems in the [World Shipping Council top container ports](https://www.worldshipping.org/top-50-container-ports), based on 2024 throughput, are represented. `containerRank2024` records coverage of that baseline; no throughput is inferred from the animation.
- Additional bulk and energy ports include the Pilbara ports, Brazilian ore gateways, Gulf oil/LNG terminals, US Gulf ports and northern European bulk gateways. [Pilbara Ports](https://www.pilbaraports.com.au/about-pilbara-ports/news%2C-media-and-statistics/news/2025/july/pilbara-ports-achieves-record-throughput-for-sixth) and [Aramco's terminal directory](https://www.aramco.com/en/what-we-do/operations/ports-and-terminals) support coverage beyond containers.
- Regional gateways extend coverage across Africa, the Americas, Europe, Asia and Oceania. These additions are an editorial selection, not ranked against the container list.
- The original nine ports remain, with their stable IDs and coordinates. Existing synthetic voyages retain their exact endpoints; new ports do not create additional synthetic voyages.

## Coordinates and port systems

`public/data/ports.json` retains Natural Earth feature IDs for its original markers and selected supplementary records. Most additions use the [NGA World Port Index](https://msi.nga.mil/Publications/WPI), retaining the record number and source name. The downloaded source hashes and URLs are recorded in `DATA-SOURCES.json`. Coordinates are rounded to six decimals without implying berth-level accuracy; the basemap and these representative points are for exploration, not navigation.

Aggregated port systems use a named representative location: Ningbo for Ningbo-Zhoushan; Yantian for Shenzhen; Taicang for Suzhou; Qinzhou for Guangxi Beibu; New York for New York-New Jersey; Bremerhaven for Bremen/Bremerhaven; Surabaya for Tanjung Perak. The Abu Dhabi marker uses the original port location, rather than claiming to locate all its terminals. Search aliases expose the aggregate names and common alternative names.

Cai Mep uses the first CMIT terminal coordinate published by the [Vietnam Seaports Association](https://www.vpa.org.vn/cai-mep-international-terminal/), converted from degrees/minutes/seconds. Dongguan uses [UN/LOCODE CNDGG](https://service.unece.org/trade/locode/cn.htm), a locality reference rather than a berth. These two records carry direct source URLs and coordinate notes.

## Display and discovery

Every port whose point is in the viewport has a marker and accessible name. Text labels are placed without collisions; the selected port and demo voyage endpoints have priority. Other labels appear where space permits and become easier to read at regional zoom. This prevents the expanded catalogue from covering vessel tracks in a wall of text.

The visible Find a port field searches the entire catalogue, including ports outside the current viewport. It matches names, aliases, accent and punctuation variants, and multiple words. Empty search starts with the ranked container hubs. Arrow keys and Enter select a result; Escape dismisses the results. Selection centers the map, prioritizes the label and opens a hero card below the map. Tapping a marker or label follows the same path. Clearing search, closing the card, selecting a vessel or changing region releases the port selection. Port search remains independent of vessel-class filters.

## Hero cards and statistics

All 135 ports have a card with a name, category and representative coordinates. `public/data/port-statistics.json` provides curated statistical profiles for 52 of them, with source references, reporting periods, units and geographic scope. The card shows an explicit “not added” state for ports without a statistical profile; it never substitutes zero or a made-up rank.

The initial collection includes WSC 2024 container throughput and global container rank for the 50 baseline port systems; 2025 cargo throughput for Rotterdam; 2024 cargo throughput for Singapore; 2024 all-type vessel arrivals for Los Angeles; and FY 2025–26 cargo throughput for Port Hedland and Dampier. Links to the authority reports appear in the cards and the provenance manifest. These are published numeric facts, not observations extracted from the animation. TEU is container capacity, tonnes measure cargo mass, and arrivals count visits rather than unique ships. They are not interchangeable measures.

Port-system scope is explicit for combined complexes and representative terminals. In particular, Shenzhen’s rank and throughput are not attributed to Yantian alone, and Cai Mep totals are not attributed to the single CMIT terminal. Authority-wide Pilbara vessel-visit totals are deliberately excluded from the individual port cards. Reporting periods remain attached to each metric rather than being presented as a common current year.

To extend the collection, add attributed numerical facts from a port authority, statistical office or named ranking publication. Specify the exact port/system, unit and calendar/fiscal period. Add the source to the shared source dictionary and update the statistics hash in `DATA-SOURCES.json`. Do not infer counts from map density, routes, synthetic segments or the absence of a published record. Current coverage is curated and incomplete, not a claim that statistics for other ports do not exist.

Regression checks validate rank coverage, units, references, aggregate scope, missing-statistics behaviour and independence from playback/filters. Browser checks cover keyboard search, map selection, close/reset flows, source links, mobile long names and small-desktop playback visibility.
