import dataset from '../../public/data/port-statistics.json'
import type { Port } from './port-labels'

export interface PortMetric {
  kind: 'containers' | 'containerRank' | 'cargo' | 'arrivals'
  value: number
  unit: 'million TEU' | 'rank' | 'million tonnes' | 'arrivals'
  period: string
  source: string
  note?: string
  /** Mutually exclusive parts, in the same unit and reporting period as the total. */
  breakdown?: { label: string; value: number }[]
  breakdownNote?: string
}
export interface PortProfile { scope: string; scopeNote: string | null; metrics: PortMetric[] }
export interface StatisticSource { name: string; title: string; url: string }
export const statisticSources: Record<string, StatisticSource> = dataset.sources
export const portProfiles: Record<string, PortProfile> = dataset.ports as Record<string, PortProfile>
export const metricLabels = { containers: 'Container throughput', containerRank: 'Global container rank', cargo: 'Cargo throughput', arrivals: 'Vessel arrivals · all types' }
export const portCategory = (port: Port) => port.selection === 'container' ? 'Container hub' : port.selection === 'bulk-energy' ? 'Bulk & energy' : port.selection === 'demo' ? 'Demo destination' : 'Regional gateway'
export const formatPortMetric = (metric: PortMetric) => metric.kind === 'containerRank' ? `#${metric.value}` : metric.value.toLocaleString('en-GB', { maximumFractionDigits: 2, minimumFractionDigits: metric.kind === 'containers' ? 2 : 0 })

export type FreightMeasure = Exclude<PortMetric['kind'], 'containerRank'>
export interface FreightRow { id: string; portIds: string[]; scope: string; scopeNote: string | null; metric: PortMetric }

/** Rank reporting areas once, even when several map markers represent the same system. */
export function freightRanking(kind: FreightMeasure, period = 'all', profiles = portProfiles): FreightRow[] {
  const areas = new Map<string, FreightRow>()
  for (const [id, profile] of Object.entries(profiles)) {
    const metric = profile.metrics.find(item => item.kind === kind && (period === 'all' || item.period === period))
    if (!metric) continue
    const key = `${profile.scope}|${metric.period}|${metric.unit}`
    const existing = areas.get(key)
    if (existing) existing.portIds.push(id)
    else areas.set(key, { id, portIds: [id], scope: profile.scope, scopeNote: profile.scopeNote, metric })
  }
  return [...areas.values()].sort((a, b) => b.metric.value - a.metric.value || a.scope.localeCompare(b.scope))
}

export function freightPeriods(kind: FreightMeasure) {
  return [...new Set(Object.values(portProfiles).flatMap(profile => profile.metrics.filter(metric => metric.kind === kind).map(metric => metric.period)))].sort().reverse()
}
