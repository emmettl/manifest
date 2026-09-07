import { useState } from 'react'
import type { Port } from '../maritime/port-labels'
import { FreightPanel } from './FreightPanel'
import type { FreightMeasure } from '../maritime/port-statistics'
import { formatPortMetric, metricLabels, portCategory, portProfiles, statisticSources } from '../maritime/port-statistics'

export function PortHero({ port, onClose }: { port: Port; onClose: () => void }) {
  const [freight, setFreight] = useState<FreightMeasure | null>(null)
  const profile = portProfiles[port.id]
  const metrics = profile?.metrics ?? []
  const sources = [...new Set(metrics.map(metric => metric.source))].map(id => statisticSources[id])
  const coordinate = (value: number, positive: string, negative: string) => `${Math.abs(value).toFixed(2)}°${value < 0 ? negative : positive}`
  return <article className="port-hero" aria-label={`${port.name} port details`}>
    <div className="port-identity">
      <p className="eyebrow">PORT PROFILE <span>/</span> {portCategory(port).toUpperCase()}</p>
      <h2>{port.name}</h2>
      <p className="port-coordinate">{coordinate(port.position[1], 'N', 'S')} <span>·</span> {coordinate(port.position[0], 'E', 'W')}</p>
    </div>
    {metrics.length ? <dl className="port-metrics">{metrics.map(metric => <div key={metric.kind}>
      <dt>{metricLabels[metric.kind]} <span>{metric.period}</span></dt>
      <dd><button className="port-metric-button" aria-label={`Explore ${metricLabels[metric.kind].toLowerCase()} for ${port.name}`} aria-haspopup="dialog" onClick={() => setFreight(metric.kind === 'containerRank' ? 'containers' : metric.kind)}><strong>{formatPortMetric(metric)}<small aria-hidden="true">↗</small></strong><span>{metric.kind === 'containerRank' ? 'by container throughput' : metric.unit}</span></button></dd>
    </div>)}</dl> : <div className="port-statistics-empty"><strong>A port on the world map.</strong><p>Published movement and throughput figures haven’t been added for this port yet.</p></div>}
    <button className="port-hero-close" aria-label="Close port details" onClick={onClose}>×</button>
    <div className="port-statistic-notes">
      <button className="freight-open" aria-haspopup="dialog" onClick={() => setFreight(metrics.some(metric => metric.kind === 'cargo') ? 'cargo' : 'containers')}>Freight by the numbers <span aria-hidden="true">↗</span></button>
      {profile && <p><span className="evidence-tag">PUBLISHED STATISTICS</span>{profile.scopeNote ?? `Reporting area: ${profile.scope}.`} {metrics.some(metric => metric.kind === 'containers') && <span>TEU = twenty-foot equivalent container unit.</span>}</p>}
      {sources.length > 0 && <p className="port-statistic-sources">Sources: {sources.map((source, index) => <span key={source.url}>{index > 0 && ' · '}<a href={source.url} target="_blank" rel="noreferrer" title={source.title}>{source.name} ↗</a></span>)} <span>· Annual figures, independent of map playback.</span></p>}
    </div>
    {freight && <FreightPanel port={port} initialMeasure={freight} onClose={() => setFreight(null)} />}
  </article>
}
