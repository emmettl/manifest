import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { createDataUrlResolver } from '@motionstudies/web/data-url'
import { OceanScene } from './components/OceanScene'
import { PortHero } from './components/PortHero'
import type { Port } from './maritime/port-labels'
import { useStudyData } from './maritime/use-study-data'
import { advanceTime, DAY, positionAt } from './maritime/playback'
import { regions, noaaRegions } from './maritime/regions'
import { registerAgentNavigation } from './maritime/agent-navigation'
import type { VesselClass } from './maritime/types'

const dataUrl = createDataUrlResolver(`${import.meta.env.BASE_URL}data/`)
const localReview = import.meta.env.DEV && new URLSearchParams(window.location.search).get('study') === 'noaa-la-2025'
const studyRegions = localReview ? noaaRegions : regions
const speedFactors = [.5, 1, 2] // Complete study in 6, 3 or 1.5 minutes.
const initialTime = localReview ? DAY * .5 : DAY * 10.5

export function App() {
  const [regionId, setRegionId] = useState(studyRegions[0].id)
  const [time, setTime] = useState(initialTime)
  const [playing, setPlaying] = useState(() => !localReview && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [speedIndex, setSpeedIndex] = useState(1)
  const { data, manifest, ready, error, retry, stats, index: chunkIndex } = useStudyData(time, playing, localReview, dataUrl)
  const [visible, setVisible] = useState<Set<VesselClass>>(() => new Set(['cargo', 'tanker']))
  const [selected, setSelected] = useState<string | null>(null)
  const [vesselQuery, setVesselQuery] = useState('')
  const [selectedPort, setSelectedPort] = useState<Port | null>(null)
  const selectVessel = useCallback((id: string | null) => { setSelected(id); setSelectedPort(null) }, [])
  const [about, setAbout] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const region = studyRegions.find(item => item.id === regionId) ?? studyRegions[0]

  useEffect(() => localReview ? undefined : registerAgentNavigation((region, day) => {
    flushSync(() => { setRegionId(region); setTime((day - 1) * DAY); setPlaying(false); setSelected(null); setSelectedPort(null) })
  }), [])

  useEffect(() => {
    if (!playing || !data || !ready) return
    let previous = 0, frame = 0, cancelled = false
    const tick = (now: number) => {
      // Commit in this animation frame so React scheduling does not halve the
      // presentation cadence. Do not catch up through time in a background tab.
      if (previous && !document.hidden) flushSync(() => setTime(current => advanceTime(current, Math.min((now - previous) / 1000, .1), data.study.duration / 180 * speedFactors[speedIndex], data.study.duration)))
      // A synchronous daily transition can clean up this effect during flushSync.
      // Do not leave its old clock running alongside the new chunk’s clock.
      if (!cancelled) { previous = now; frame = requestAnimationFrame(tick) }
    }
    frame = requestAnimationFrame(tick)
    return () => { cancelled = true; cancelAnimationFrame(frame) }
  }, [playing, data, ready, speedIndex])

  useEffect(() => { if (about) dialogRef.current?.showModal(); else dialogRef.current?.close() }, [about])
  const activeVessels = useMemo(() => {
    if (!data || !ready) return []
    const ids = new Set(data.study.segments.filter(segment => time >= segment.samples[0].time && time <= segment.samples[segment.samples.length - 1].time).map(segment => segment.vesselId))
    return data.study.vessels.filter(vessel => ids.has(vessel.id) && visible.has(vessel.category))
  }, [data, ready, time, visible])
  const vessel = selected ? data?.study.vessels.find(item => item.id === selected) : undefined
  const vesselChoices = useMemo(() => {
    const query = vesselQuery.trim().toLowerCase()
    if (!query) return activeVessels.slice(0, 100)
    const matches = []
    for (const item of activeVessels) {
      if (`${item.label} ${item.id}`.toLowerCase().includes(query)) matches.push(item)
      if (matches.length === 100) break
    }
    return matches
  }, [activeVessels, vesselQuery])
  const residentSampleCount = useMemo(() => data?.study.segments.reduce((total, segment) => total + segment.samples.length, 0) ?? 0, [data])
  const sampleCount = manifest?.sampleCount ?? residentSampleCount
  const selectedSegment = selected ? data?.study.segments.find(item => item.vesselId === selected && positionAt(item, time)) : undefined
  const position = selectedSegment ? positionAt(selectedSegment, time) : null
  const toggle = (category: VesselClass) => {
    setVisible(current => { const next = new Set(current); if (next.has(category)) next.delete(category); else next.add(category); return next })
    if (vessel?.category === category) setSelected(null)
  }
  const totalDays = data ? Math.ceil(data.study.duration / DAY) : localReview ? 3 : 30
  const day = Math.min(totalDays, Math.floor(time / DAY) + 1)
  const hours = String(Math.floor(time % DAY / 3600)).padStart(2, '0')
  const minutes = String(Math.floor(time % 3600 / 60)).padStart(2, '0')
  const calendarDate = data ? new Date(Date.parse(data.study.startUtc) + time * 1000).toISOString().slice(0, 10) : '2025-01-01'
  const gapMinutes = (data?.study.audit?.maxGapSeconds ?? 600) / 60
  const exactSample = selectedSegment?.samples.some(sample => sample.time === time)

  return <main className="study">
    <header className="masthead">
      <div><p className="eyebrow">MOTION STUDIES <span>/</span> WORK IN PROGRESS</p><h1>MANIFEST<span className="title-dot">.</span></h1><p className="subtitle">World trade in motion</p></div>
      <div className="header-meta"><span className="demo-badge"><i />{localReview ? 'OBSERVED AIS · LOCAL REVIEW' : 'SYNTHETIC STUDY'}</span><button className="text-button" onClick={() => setAbout(true)}>About the data <span aria-hidden="true">↗</span></button></div>
    </header>

    <nav className="chapters" aria-label="Study regions">{studyRegions.map(item => <button key={item.id} aria-pressed={regionId === item.id} data-tooltip={`Explore ${item.title.toLowerCase()}`} onClick={() => { setRegionId(item.id); setSelected(null); setSelectedPort(null) }}><span>{item.number}</span>{item.label}</button>)}</nav>

    <section className="map-surface" aria-label="Maritime study">
      {data ? <OceanScene study={data.study} land={data.land} time={time} playing={playing && ready} region={region} visible={visible} selected={selected} onSelect={selectVessel} selectedPort={selectedPort} onPortSelect={setSelectedPort} /> : <div className="load-state" role="status">{error ? <><p>{localReview ? 'The local NOAA sample is unavailable. Prepare it with npm run data:noaa, then try again.' : 'The study could not be loaded.'}</p><button onClick={retry}>Try again</button></> : <p>Opening the ocean study…</p>}</div>}
      {data && !ready && <div className="chunk-loading" role="status">{error ? <><p>Movement data for this day could not be loaded.</p><button onClick={retry}>Retry this day</button></> : <p>Loading movement for day {chunkIndex + 1}…</p>}</div>}
      {manifest && <div className="delivery-readout" role="note" aria-label="Data delivery" data-state={ready ? 'ready' : error ? 'error' : 'loading'} data-chunk={chunkIndex} data-cached={stats?.cachedChunks ?? 0} data-decoded-bytes={stats?.decodedBytes ?? 0} data-resident-samples={stats?.residentSamples ?? 0} data-fetched-bytes={stats?.fetchedBytes ?? 0}>
        Day {chunkIndex + 1}/{manifest.chunks.length} · {stats?.cachedChunks ?? 0}/2 chunks cached · {((stats?.decodedBytes ?? 0) / 1024 / 1024).toFixed(1)} MiB decoded{stats ? ` · ${Math.round(stats.lastLoadMs)} ms load/decode` : ''}
      </div>}
      <div className="layer-controls" aria-label="Vessel classes">
        <button aria-label="Cargo" aria-pressed={visible.has('cargo')} data-tooltip={localReview ? 'Show or hide NOAA cargo-class vessels' : 'Show or hide synthetic cargo vessels'} onClick={() => toggle('cargo')}><i className="cargo-dot" />Cargo</button>
        <button aria-label="Tankers" aria-pressed={visible.has('tanker')} data-tooltip={localReview ? 'Show or hide NOAA tanker-class vessels' : 'Show or hide synthetic tankers'} onClick={() => toggle('tanker')}><i className="tanker-dot" />Tankers</button>
      </div>
      {data && ready && <div className="field-count"><strong>{activeVessels.length.toLocaleString('en-US')}</strong><span>{localReview ? 'vessels in accepted segments' : 'synthetic vessels with positions'}</span><small>{data.study.vessels.length.toLocaleString('en-US')} vessels in the full study</small></div>}
      {data && ready && !visible.size && <div className="empty-hint">Choose Cargo or Tankers to show movement.</div>}
    </section>

    <section className="study-notes" aria-label="Study details">
      {selectedPort ? <PortHero port={selectedPort} onClose={() => { setSelectedPort(null); document.getElementById('port-search')?.focus() }} /> : <>
      <div className="chapter-copy"><p className="eyebrow">{region.number} <span>/</span> {region.label.toUpperCase()}</p><h2>{region.title}</h2><p>{region.description}</p></div>
      <div className="evidence-panel">
        <label htmlFor="vessel">{localReview ? 'Inspect an observed vessel' : 'Inspect a demo vessel'}</label>
        <div className="vessel-picker">
        <input type="search" aria-label="Find a vessel" placeholder="Find vessel by label or ID" value={vesselQuery} onChange={event => setVesselQuery(event.target.value)} />
        <select id="vessel" value={selected ?? ''} onChange={event => setSelected(event.target.value || null)}>
          <option value="">Select a moving mark or choose here</option>
          {vessel && !vesselChoices.some(item => item.id === vessel.id) && <option value={vessel.id}>{vessel.label} — selected</option>}
          {vesselChoices.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          <option value="" disabled>{vesselChoices.length ? 'Up to 100 matches · search to narrow the list' : 'No active vessels match'}</option>
        </select>
        </div>
        {vessel ? <p><span className="evidence-tag">{localReview ? 'OBSERVED AIS' : 'SYNTHETIC'}</span> {!ready ? 'Loading movement data…' : position ? `${Math.abs(position[1]).toFixed(2)}°${position[1] < 0 ? 'S' : 'N'} · ${Math.abs(position[0]).toFixed(2)}°${position[0] < 0 ? 'W' : 'E'}` : 'No position at this time.'} <span className="muted">{!ready ? '' : localReview ? `${position ? exactSample ? 'Received sample.' : 'Interpolated between received samples.' : 'Reception gap or outside the regional sample.'} NOAA vessel class; cargo contents unknown.` : 'Interpolated demo position; no observed voyage or cargo claim.'}</span></p> : <p>{region.caption} <span className="muted">{localReview ? `Interpolation capped at ${gapMinutes} minutes. Local review; publication pending.` : 'These movements are generated, not observed.'}</span></p>}
      </div>
      </>}
    </section>

    <footer className="playback">
      <div className="transport"><button className="play-button" disabled={!data} aria-label={playing ? 'Pause playback' : 'Play playback'} data-tooltip={playing ? 'Pause the study clock' : 'Resume the study clock'} onClick={() => setPlaying(value => !value)}>{playing ? 'Ⅱ' : '▶'}</button><div className="clock"><strong>{localReview ? calendarDate : `DAY ${String(day).padStart(2,'0')}`}</strong><span>{hours}:{minutes} <span className="clock-zone">{localReview ? 'UTC' : 'DEMO UTC'}</span></span></div></div>
      <div className="timeline"><label className="sr-only" htmlFor="time">Study time</label><input id="time" type="range" min="0" max={data?.study.duration ? data.study.duration - 1 : totalDays * DAY - 1} step="60" value={time} disabled={!data} aria-valuetext={`${localReview ? calendarDate : `Demo day ${day}`}, ${hours}:${minutes} UTC`} onChange={event => { setPlaying(false); setTime(Number(event.target.value)) }} /><div className="timeline-labels">{localReview ? <><span>01 JAN</span><span>02 JAN</span><span>03 JAN</span><span>04 JAN</span></> : <><span>DAY 01</span><span>10</span><span>20</span><span>30</span></>}</div></div>
      <button className="speed-button" data-tooltip="Change the playback speed" aria-label={`Playback speed ${speedFactors[speedIndex]} times. Click to change.`} onClick={() => setSpeedIndex(value => (value + 1) % speedFactors.length)}>{speedFactors[speedIndex]}×</button>
      <button className="restart-button" aria-label="Restart study" data-tooltip="Return to day one" onClick={() => { setTime(0); setSelected(null) }}>↤</button>
    </footer>

    <dialog ref={dialogRef} onCancel={() => setAbout(false)} onClose={() => setAbout(false)} aria-labelledby="about-title">
      <div className="dialog-head"><p className="eyebrow">SOURCE NOTES / V0.1</p><button aria-label="Close source notes" onClick={() => setAbout(false)}>×</button></div>
      <h2 id="about-title">A study taking shape.</h2><p>MANIFEST explores how vessel movement can make the world’s trade routes visible. This first version is a working prototype.</p>
      {localReview ? <>
        <p><strong>Real observations, shown in local review.</strong> This sample covers 1–3 January 2025 within 120–117°W and 32.5–34.5°N. It includes NOAA cargo and tanker classes only. Stationary reports remain visible. Holiday traffic and coastal reception do not establish typical activity or global coverage.</p>
        <dl><dt>Movement and credit</dt><dd><a href="https://www.fisheries.noaa.gov/inport/item/77594/full-list" target="_blank" rel="noreferrer">Nationwide Automatic Identification System 2025</a>. U.S. Coast Guard Navigation Center, Bureau of Ocean Energy Management, NOAA Office for Coastal Management.</dd><dt>What the marks mean</dt><dd>Received positions, interpolated only within accepted segments. Gaps over {gapMinutes} minutes, apparent speeds over {data?.study.audit?.maxSpeedKnots ?? 45} knots, conflicting reports and observed exits from the region break tracks. No extrapolation through gaps.</dd><dt>Classification</dt><dd>NOAA’s supplied vessel types include AVID enrichment. Their historical registry validity is not established. Identifiers are MMSIs, not verified hull identities. No cargo contents, trade volumes or port calls are asserted.</dd><dt>Publication</dt><dd>NOAA metadata lists no access constraints and “For coastal and ocean planning” as its use constraint. Public artwork redistribution remains under review. This sample is served locally and excluded from the public build.</dd><dt>Geography</dt><dd>Natural Earth, public domain, 1:10 million, regional polygon selection. Small harbour structures are generalized; this is not a navigational chart.</dd></dl>
      </> : <>
        <p><strong>Every vessel and journey here is synthetic.</strong> The 30-day clock is illustrative. Routes are schematic, vessel counts are invented, and the animation does not measure cargo contents or trade volumes. Port cards show separately sourced annual statistics.</p>
        <p>The complete performance fixture contains {data?.study.vessels.length.toLocaleString('en-US')} vessels and {sampleCount.toLocaleString('en-US')} route samples. Voyages are staggered, so the count with positions varies with time and class filters; the drawn count also depends on the viewport and wrapped world copies. Daily chunks retain the original samples needed for every qualifying mark and its full prototype wake. The current day loads on demand, playback prefetches the next day, and only two decoded chunks are cached. The delivery meter reports decoded JSON bytes, not JavaScript heap size; its load time includes fetching, integrity checking, decoding and validation. This tests fleet-scale loading and rendering, not raw AIS sampling volume or realistic traffic distribution. The on-map meter reports CPU preparation and drawing submission against a 16.7 ms frame budget; it is not a measurement of total frame or GPU time.</p>
        <dl><dt>Movement</dt><dd>Deterministic authored fixture, CC0. No live feed, AIS recording or vessel identity.</dd><dt>Geography</dt><dd><a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer">Natural Earth</a>, public-domain land geometry at 1:110 million scale. Not for navigation.</dd><dt>Port statistics</dt><dd>Port cards cite published container rankings, throughput and vessel-arrival figures where added. Each metric carries its reporting period and source. Rankings use the World Shipping Council’s 2024 container-port baseline; combined port systems are identified explicitly. These figures are independent of the study clock.</dd><dt>Next evidence</dt><dd>A regional historical AIS proof, followed by a decision on global tracks or aggregate presence. Observed, reported, inferred and statistical evidence will remain distinct.</dd></dl>
      </>}
      <a className="repo-link" href="https://github.com/emmettl/manifest" target="_blank" rel="noreferrer">Repository & study notes ↗</a>
    </dialog>
  </main>
}
