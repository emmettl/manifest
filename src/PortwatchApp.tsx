import { useEffect, useMemo, useRef, useState } from 'react'
import type { LandCollection } from './maritime/types'
import { baselineMean, dailyValue, parseActivity, relativeChange, seriesPath, shipCategories, trailingMean, type ActivityLocation, type ActivityStudy, type Metric } from './maritime/portwatch'
import './portwatch.css'

const format = (n: number | null, digits = 0) => n === null ? '—' : n.toLocaleString('en-GB', { maximumFractionDigits: digits })
const dateLabel = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
const colours = ['#edbd77', '#89b6c8', '#a8cba7']
const focusIds = ['chokepoint1', 'chokepoint4', 'chokepoint7']
const project = ([lon, lat]: number[]) => [(lon + 180) * 2.5, (85 - lat) * 2.5]
function landPath(land: LandCollection) {
  return land.features.flatMap(({ geometry }) => {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates as number[][][]] : geometry.coordinates as number[][][][]
    return polygons.map(polygon => polygon.map(ring => ring.map((p, i) => `${i ? 'L' : 'M'}${project(p).map(n => n.toFixed(2)).join(',')}`).join(' ') + 'Z').join(' '))
  }).join(' ')
}
function Chart({ values, average, day, colour, label }: { values: (number | null)[]; average: (number | null)[]; day: number; colour: string; label: string }) {
  const max = Math.max(1, ...values.filter((n): n is number => n !== null))
  const x = day / Math.max(1, values.length - 1) * 300
  return <svg className="pw-chart" viewBox="0 -3 300 66" role="img" aria-label={label}>
    <path d="M0,60H300" stroke="#34414a" fill="none" />
    <path d={seriesPath(values, 300, 60, max)} stroke={colour} opacity=".28" strokeWidth="1" fill="none" />
    <path d={seriesPath(average, 300, 60, max)} stroke={colour} strokeWidth="1.7" fill="none" />
    <path d={`M${x},0V60`} stroke="#e3e8e9" strokeDasharray="2 3" opacity=".65" />
  </svg>
}

export function PortwatchApp() {
  const [study, setStudy] = useState<ActivityStudy | null>(null)
  const [land, setLand] = useState<LandCollection | null>(null)
  const [error, setError] = useState(false), [attempt, setAttempt] = useState(0)
  const [day, setDay] = useState(0), [playing, setPlaying] = useState(false)
  const [kind, setKind] = useState<'chokepoint' | 'port'>('chokepoint')
  const [selected, setSelected] = useState('chokepoint1'), [category, setCategory] = useState(0)
  const [metric, setMetric] = useState<Metric>('calls'), [world, setWorld] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const controller = new AbortController()
    setError(false)
    const read = async (url: string) => { const response = await fetch(url, { signal: controller.signal }); if (!response.ok) throw new Error('Unavailable'); return response.json() }
    Promise.all([read('/__local/portwatch-study.json').then(parseActivity), read(`${import.meta.env.BASE_URL}data/land.geojson`)]).then(([data, geography]) => {
      if (!controller.signal.aborted) { setStudy(data); setLand(geography); setDay(Math.max(0, data.dates.indexOf('2024-01-31'))) }
    }).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [attempt])
  useEffect(() => {
    if (!playing || !study) return
    const timer = window.setInterval(() => {
      if (document.hidden) return
      setDay(value => {
        if (value >= study.dates.length - 1) return value
        return value + 1
      })
    }, 550)
    return () => clearInterval(timer)
  }, [playing, study])
  useEffect(() => { if (study && day >= study.dates.length - 1) setPlaying(false) }, [day, study])
  const geography = useMemo(() => land ? landPath(land) : '', [land])
  const visible = useMemo(() => study?.locations.filter(location => location.kind === kind) ?? [], [study, kind])
  const selectedLocation = visible.find(location => location.id === selected) ?? visible[0]
  const max = useMemo(() => Math.max(1, ...visible.flatMap(location => location.days.map((_, i) => dailyValue(location, i, metric, category) ?? 0))), [visible, metric, category])
  const switchKind = (next: 'port' | 'chokepoint') => { setKind(next); setMetric('calls'); setSelected(next === 'port' ? 'port1201' : 'chokepoint1'); if (next === 'port') setWorld(true) }
  const jump = (value: number) => { setPlaying(false); setDay(value) }
  const pick = (location: ActivityLocation) => { setSelected(location.id); setPlaying(false) }
  const summaryLocations = kind === 'chokepoint' ? focusIds.map(id => visible.find(location => location.id === id)).filter((location): location is ActivityLocation => !!location) : visible.filter(location => ['port1188', 'port1201', 'port1114'].includes(location.id))
  const unit = metric === 'calls' ? kind === 'port' ? 'port calls' : 'transits' : 'estimated tonnes'
  const daily = selectedLocation ? dailyValue(selectedLocation, day, metric, category) : null
  const smoothed = selectedLocation ? trailingMean(selectedLocation, day, metric, category) : null
  const baseline = study && selectedLocation ? baselineMean(study, selectedLocation, metric, category) : null
  const change = relativeChange(smoothed, baseline)
  return <main className="pw-study">
    <header className="pw-header">
      <div><p className="pw-kicker">MOTION STUDIES <span>/</span> PORTWATCH STUDY</p><h1>MANIFEST<span>.</span></h1></div>
      <div className="pw-heading"><p>Where the world passes.</p><span>Ports, passages & the changing rhythm of trade</span></div>
      <button className="pw-source-button" onClick={() => dialog.current?.showModal()}>About the data <span>↗</span></button>
    </header>
    {!study || !land ? <section className="pw-loading" role={error ? 'alert' : 'status'}>{error ? <><h2>The PortWatch study is unavailable.</h2><p>Prepare the local sample with <code>npm run data:portwatch</code>.</p><button onClick={() => setAttempt(value => value + 1)}>Try again</button></> : <p>Opening the historical record…</p>}</section> : <>
      <nav className="pw-toolbar" aria-label="Activity controls">
        <div className="pw-tabs"><button aria-pressed={kind === 'chokepoint'} onClick={() => switchKind('chokepoint')}>01 <span>Passages</span></button><button aria-pressed={kind === 'port'} onClick={() => switchKind('port')}>02 <span>Ports</span></button></div>
        <label>Vessels<select aria-label="Vessel category" value={category} onChange={event => setCategory(Number(event.target.value))}>{shipCategories.map((label, i) => <option key={label} value={i}>{label}</option>)}</select></label>
        <label>Measure<select aria-label="Activity measure" value={metric} onChange={event => setMetric(event.target.value as Metric)}><option value="calls">{kind === 'port' ? 'Port calls' : 'Transits'}</option>{kind === 'port' ? <><option value="imports">Estimated imports</option><option value="exports">Estimated exports</option></> : <option value="transit">Estimated transit volume</option>}</select></label>
        <span className="pw-evidence"><i />AIS-derived daily aggregates</span>
      </nav>
      <section className="pw-main">
        <div className="pw-map">
          <div className="pw-map-top"><div><span className="pw-kicker">{world ? 'SELECTED GLOBAL LOCATIONS' : 'THE RED SEA & THE CAPE'}</span><p>{visible.length} {kind === 'port' ? 'ports' : 'passages'} · {shipCategories[category].toLowerCase()}</p></div><button onClick={() => setWorld(value => !value)}>{world ? 'Focus on Africa' : 'World view'} <span>↗</span></button></div>
          <svg className="pw-geography" viewBox={world ? '0 0 900 425' : '390 50 390 290'} aria-label="Daily maritime activity map">
            <defs><radialGradient id="pw-glow"><stop offset="0" stopColor="#edbd77" stopOpacity=".5"/><stop offset="1" stopColor="#edbd77" stopOpacity="0"/></radialGradient></defs>
            <g stroke="#22333b" strokeWidth=".4" strokeDasharray="1 5" opacity=".6">{Array.from({ length: 13 }, (_, i) => <path key={`lon${i}`} d={`M${i * 75},0V425`} />)}{Array.from({ length: 6 }, (_, i) => <path key={`lat${i}`} d={`M0,${i * 75}H900`} />)}</g>
            <path d={geography} fill="#14242c" stroke="#3a515a" strokeWidth=".55" fillRule="evenodd" />
            {visible.map(location => {
              const [x, y] = project(location.position), value = dailyValue(location, day, metric, category)
              const radius = value === null ? 3 : Math.sqrt(value / max) * 17
              const chosen = location.id === selectedLocation?.id
              const colour = colours[Math.max(0, focusIds.indexOf(location.id))]
              return <g key={location.id} className="pw-marker" role="button" tabIndex={0} aria-pressed={chosen} aria-label={`${location.name}: ${format(value)} ${unit}`} onClick={() => pick(location)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pick(location) } }}>
                <title>{location.name}: {value === null ? 'No data' : `${format(value)} ${unit}`}</title>
                <circle cx={x} cy={y} r={Math.max(11, radius + 3)} fill="transparent" />
                {chosen && <circle cx={x} cy={y} r={radius + 13} fill="url(#pw-glow)" />}
                <circle cx={x} cy={y} r={Math.max(1, radius)} fill={colour} fillOpacity={value === null ? 0 : .16} stroke={colour} strokeWidth={chosen ? 1.1 : .65} strokeDasharray={value === null ? '2 2' : undefined} />
                <circle cx={x} cy={y} r={value === 0 || value === null ? .7 : 1.7} fill={colour} />
                {(chosen || (!world && focusIds.includes(location.id))) && <text x={x + Math.max(5, radius) + 4} y={y + 2} fill={colour} fontSize={world ? 8 : 6}>{location.name.replace(' Strait', '')}</text>}
              </g>
            })}
          </svg>
          <div className="pw-map-bottom"><span><i />Circle area = daily {unit}<br /><small>Fixed scale across the full period · {metric === 'calls' ? 'Counts' : 'Volume estimates'} at each location</small></span><span>01 NOV 2023<br />31 MAR 2024</span></div>
        </div>
        <aside className="pw-detail" aria-label="Selected location">
          <label className="pw-kicker" htmlFor="pw-place">INSPECT A {kind === 'port' ? 'PORT' : 'PASSAGE'}</label>
          <select id="pw-place" value={selectedLocation.id} onChange={event => { setSelected(event.target.value); setPlaying(false) }}>{visible.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}</select>
          <p className="pw-location-meta">{selectedLocation.country ?? 'International maritime passage'}</p>
          <p className="pw-date">{dateLabel(study.dates[day])} <span>UTC</span></p>
          <div className="pw-value" data-testid="pw-daily">{format(daily)}</div><p className="pw-unit">{daily === null ? `No data for ${unit}` : `${unit} this day`}</p>
          <dl className="pw-statistics"><div><dt>Trailing 7-day mean</dt><dd>{format(smoothed, 1)}</dd></div><div><dt>November daily mean</dt><dd>{format(baseline, 1)}</dd></div><div><dt>7-day mean vs November</dt><dd className="pw-change">{change === null ? '—' : `${change > 0 ? '+' : ''}${format(change, 1)}%`}</dd></div></dl>
          <p className="pw-note">{kind === 'chokepoint' ? 'Passages count transits in both directions. The same vessel can appear at several passages.' : 'Calls count entries into a port, subject to PortWatch’s visit filters. Import and export volumes are model estimates.'}</p>
          <p className="pw-note">{metric === 'calls' ? 'AIS-derived counts are affected by reception and classification.' : 'Estimated tonnes describe aggregate activity; they do not identify the contents of a ship.'}</p>
        </aside>
      </section>
      <section className="pw-comparison" aria-label="Activity over time">
        <div className="pw-comparison-heading"><div><p className="pw-kicker">{kind === 'chokepoint' ? 'THREE PASSAGES, ONE PERIOD' : 'PORTS IN CONTEXT'}</p><h2>{kind === 'chokepoint' ? 'The long way around.' : 'The rhythm of arrival.'}</h2></div><p>Faint: daily {unit} · Solid: trailing 7-day mean<br />Each chart uses its own vertical scale.</p></div>
        <div className="pw-series">{summaryLocations.map((location, i) => {
          const values = study.dates.map((_, d) => dailyValue(location, d, metric, category)), average = study.dates.map((_, d) => trailingMean(location, d, metric, category))
          return <button key={location.id} aria-pressed={selectedLocation.id === location.id} onClick={() => pick(location)} style={{ '--series-colour': colours[i] } as React.CSSProperties}>
            <div><span>{location.name}</span><strong>{format(values[day])}</strong></div>
            <Chart values={values} average={average} day={day} colour={colours[i]} label={`${location.name}: ${unit}, daily and 7-day mean`} />
            <div className="pw-chart-labels"><span>NOV</span><span>DEC</span><span>JAN</span><span>FEB</span><span>MAR</span></div>
          </button>
        })}</div>
      </section>
      <footer className="pw-playback">
        <button className="pw-play" aria-label={playing ? 'Pause playback' : 'Play playback'} onClick={() => { if (!playing && day === study.dates.length - 1) setDay(0); setPlaying(value => !value) }}>{playing ? 'Ⅱ' : '▶'}</button>
        <div className="pw-current-date"><strong>{dateLabel(study.dates[day])}</strong><span>Day {day + 1} of {study.dates.length} · daily UTC</span></div>
        <div className="pw-scrubber"><label className="sr-only" htmlFor="pw-day">Study date</label><input id="pw-day" type="range" min={0} max={study.dates.length - 1} step={1} value={day} aria-valuetext={dateLabel(study.dates[day])} onChange={event => jump(Number(event.target.value))} /><div><span>01 NOV 2023</span><span>31 MAR 2024</span></div></div>
        <button className="pw-reset" onClick={() => jump(0)}>Restart ↺</button>
      </footer>
      <div className="pw-credit"><span>Sources: UN Global Platform; <a href="https://portwatch.imf.org/" target="_blank" rel="noreferrer">IMF PortWatch</a>.</span><span>Historical sample · {study.audit.availableDays.toLocaleString()} / {study.audit.expectedDays.toLocaleString()} location-days · Local review</span></div>
    </>}
    <dialog ref={dialog} className="pw-dialog"><div className="dialog-head"><p className="pw-kicker">THE EVIDENCE</p><button aria-label="Close data information" onClick={() => dialog.current?.close()}>×</button></div><h2>Activity at the water’s edge.</h2><p>This study follows daily activity at eight selected ports and eight passages from 1 November 2023 to 31 March 2024. It uses published PortWatch statistics derived from AIS.</p><p>Circles show daily counts or estimated tonnes. Their area uses a fixed scale for the selected measure and vessel category across the full period. They are stationary location markers, not individual ships or routes.</p><p>The three passage charts allow comparison around Africa. They do not establish that particular vessels diverted from one passage to another. Ports and passages are not added into a global vessel total.</p><p>The solid lines require seven consecutive reported days. Missing values remain missing; zero means a reported zero. Percentage changes compare the trailing seven-day mean with the complete November daily mean.</p><p>Source data can be revised. Snapshot retrieved {study?.source.capturedUtc.slice(0, 10) ?? '—'}. Selection, charting, seven-day averages and November comparisons are Motion Studies transformations.</p><p><a href="https://portwatch.imf.org/" target="_blank" rel="noreferrer">Sources: UN Global Platform; IMF PortWatch</a> · <a href="https://www.imf.org/en/about/copyright-and-terms" target="_blank" rel="noreferrer">IMF data terms</a></p></dialog>
  </main>
}
