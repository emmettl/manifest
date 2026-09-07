import { useEffect, useRef, useState } from 'react'
import type { Port } from '../maritime/port-labels'
import { formatPortMetric, freightPeriods, freightRanking, metricLabels, portProfiles, statisticSources, type FreightMeasure, type PortMetric } from '../maritime/port-statistics'

const measures: { kind: FreightMeasure; label: string; unit: string }[] = [
  { kind: 'cargo', label: 'Tonnage', unit: 'million tonnes' },
  { kind: 'containers', label: 'Containers', unit: 'million TEU' },
  { kind: 'arrivals', label: 'Vessel arrivals', unit: 'arrivals' },
]

function Source({ metric }: { metric: PortMetric }) {
  const source = statisticSources[metric.source]
  return <a href={source.url} target="_blank" rel="noreferrer" title={source.title}>{source.name} ↗</a>
}

export function FreightPanel({ port, initialMeasure, onClose }: { port: Port; initialMeasure: FreightMeasure; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const detailRef = useRef<HTMLHeadingElement>(null)
  const [measure, setMeasure] = useState(initialMeasure)
  const [period, setPeriod] = useState('all')
  const [limit, setLimit] = useState(10)
  const [detailId, setDetailId] = useState(port.id)
  const profile = portProfiles[detailId]
  const metric = profile?.metrics.find(item => item.kind === measure)
  const rows = freightRanking(measure, period)
  const shown = rows.slice(0, limit)
  const selectedRow = rows.find(row => row.portIds.includes(detailId))
  const selectedPosition = selectedRow ? rows.indexOf(selectedRow) + 1 : null
  const unit = measures.find(item => item.kind === measure)!.unit
  const max = rows[0]?.metric.value ?? 1
  const parts = metric?.breakdown?.slice().sort((a, b) => b.value - a.value) ?? []

  useEffect(() => {
    const dialog = dialogRef.current!
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previous
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [])

  return <dialog className="freight-panel" ref={dialogRef} aria-labelledby="freight-title" onCancel={onClose} onClose={onClose}>
    <div className="freight-header">
      <div><p className="eyebrow">MANIFEST <span>/</span> PUBLISHED STATISTICS</p><h2 id="freight-title">Freight by the numbers</h2><p>Explore the scale of the ports on the map.</p></div>
      <button autoFocus className="freight-close" aria-label="Close freight by the numbers" onClick={onClose}>×</button>
    </div>
    <div className="freight-controls">
      <div className="freight-measures" role="group" aria-label="Freight measure">{measures.map(item => <button key={item.kind} aria-pressed={measure === item.kind} onClick={() => { setMeasure(item.kind); setPeriod('all') }}>{item.label}</button>)}</div>
      <label>Reporting period<select value={period} onChange={event => setPeriod(event.target.value)}><option value="all">Published years · mixed</option>{freightPeriods(measure).map(year => <option key={year}>{year}</option>)}</select></label>
      <label>Show<select aria-label="Number of ports" value={limit} onChange={event => setLimit(Number(event.target.value))}>{[5, 10, 20, 50].map(n => <option key={n} value={n}>Top {n}</option>)}</select></label>
    </div>
    <div className="freight-content">
      <section className="freight-comparison" aria-labelledby="freight-comparison-title">
        <div className="freight-section-heading"><h3 id="freight-comparison-title">Top {shown.length} by {measure === 'cargo' ? 'cargo tonnage' : measure === 'containers' ? 'container throughput' : 'vessel arrivals'}</h3><span>{unit}</span></div>
        <p className="freight-caption">{rows.length} reporting areas with this measure{period !== 'all' && ` in ${period}`}. Catalogue comparison; coverage is not a global ranking. {period === 'all' && 'Years differ; choose a period to compare the same reporting year.'}</p>
        <ol className="freight-bars" aria-label={`${metricLabels[measure]} comparison`}>{shown.map((row, index) => <li key={row.id} data-highlighted={row.portIds.includes(detailId)}>
          <button onClick={() => { setDetailId(row.id); detailRef.current?.focus() }} aria-pressed={row.portIds.includes(detailId)} aria-label={`Inspect ${row.scope}: ${formatPortMetric(row.metric)} ${unit}, ${row.metric.period}`}>
            <span className="freight-rank">{String(index + 1).padStart(2, '0')}</span><span className="freight-bar-label">{row.scope}<small>{row.metric.period}</small></span><strong>{formatPortMetric(row.metric)}</strong>
            <span className="freight-bar-track" aria-hidden="true"><span style={{ width: `${row.metric.value / max * 100}%` }} /></span>
          </button>
          <div className="freight-row-source"><Source metric={row.metric} /></div>
        </li>)}</ol>
        {shown.length === 0 && <p className="freight-empty">No published figures in this selection.</p>}
      </section>
      <section className="freight-detail" aria-labelledby="freight-detail-title">
        <p className="eyebrow">REPORTING AREA</p><h3 id="freight-detail-title" ref={detailRef} tabIndex={-1}>{profile?.scope ?? port.name}</h3>
        {profile?.scopeNote && <p className="freight-caption">{profile.scopeNote}</p>}
        {metric ? <>
          <p className="freight-total"><strong>{formatPortMetric(metric)}</strong><span>{unit} · {metric.period}</span></p>
          <p className="freight-caption">{selectedPosition ? `Position ${selectedPosition} of ${rows.length} reporting areas in this selection.${selectedPosition > limit ? ' Outside the displayed top ' + limit + '.' : ''}` : 'This figure is outside the selected reporting period.'}</p>
          {metric.note && <p className="freight-caption">{metric.note}</p>}
          <div className="freight-breakdown">
            <h4>{measure === 'cargo' ? 'Cargo breakdown' : measure === 'containers' ? 'Container breakdown' : 'Arrivals breakdown'}</h4>
            {parts.length ? <>
              <ul aria-label="Published breakdown">{parts.map(part => <li key={part.label}><div><span>{part.label}</span><strong>{formatPortMetric({ ...metric, value: part.value })}</strong></div><div className="freight-part-track" aria-hidden="true"><span style={{ width: `${part.value / metric.value * 100}%` }} /></div><small>{(part.value / metric.value * 100).toFixed(1)}% of total</small></li>)}</ul>
              {metric.breakdownNote && <p className="freight-caption">{metric.breakdownNote}</p>}
            </> : <p className="freight-caption">The collected source provides a total for this measure. A breakdown has not been added.</p>}
          </div>
          <p className="freight-detail-source"><Source metric={metric} /></p>
        </> : <p className="freight-empty">No published {measure === 'cargo' ? 'tonnage' : measure} figure has been added for this port. Choose another measure or inspect a port in the chart.</p>}
      </section>
    </div>
    <p className="freight-footnote">Annual port statistics are independent of the synthetic vessels and playback clock. TEU measures container capacity; tonnes measure cargo mass; arrivals count visits. Shared port systems appear once in each comparison.</p>
  </dialog>
}
