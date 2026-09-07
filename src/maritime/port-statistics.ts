import dataset from '../../public/data/port-statistics.json'
import type { Port } from './port-labels'

export interface PortMetric {
  kind: 'containers' | 'containerRank' | 'cargo' | 'arrivals'
  value: number
  unit: 'million TEU' | 'rank' | 'million tonnes' | 'arrivals'
  period: string
  source: string
}
export interface PortProfile { scope: string; scopeNote: string | null; metrics: PortMetric[] }
export interface StatisticSource { name: string; title: string; url: string }
export const statisticSources: Record<string, StatisticSource> = dataset.sources
export const portProfiles: Record<string, PortProfile> = dataset.ports as Record<string, PortProfile>
export const metricLabels = { containers: 'Container throughput', containerRank: 'Global container rank', cargo: 'Cargo throughput', arrivals: 'Vessel arrivals · all types' }
export const portCategory = (port: Port) => port.selection === 'container' ? 'Container hub' : port.selection === 'bulk-energy' ? 'Bulk & energy' : port.selection === 'demo' ? 'Demo destination' : 'Regional gateway'
export const formatPortMetric = (metric: PortMetric) => metric.kind === 'containerRank' ? `#${metric.value}` : metric.value.toLocaleString('en-GB', { maximumFractionDigits: 2, minimumFractionDigits: metric.kind === 'containers' ? 2 : 0 })
