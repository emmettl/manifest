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

The Ports control lists the entire catalogue, including ports outside the current viewport. Search matches both display names and aliases. Selecting a result centers and zooms the map and gives that port first priority for a visible label. Escape closes the directory and restores focus to its toggle. The directory remains independent of vessel-class filters.
