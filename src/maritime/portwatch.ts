import { validatePortwatch } from '../../scripts/portwatch-core.mjs'

export type Metric = 'calls' | 'imports' | 'exports' | 'transit'
export interface ActivityDay { calls: (number | null)[]; imports?: (number | null)[]; exports?: (number | null)[]; transit?: (number | null)[] }
export interface ActivityLocation { id: string; name: string; country: string | null; kind: 'port' | 'chokepoint'; position: [number, number]; days: (ActivityDay | null)[] }
export interface ActivityStudy {
  kind: 'portwatch-activity'; start: string; end: string; dates: string[]; locations: ActivityLocation[]
  source: { attribution: string; capturedUtc: string; url: string; terms: string }
  baseline: { start: string; end: string; days: number }
  audit: { availableDays: number; expectedDays: number; missingDays: string[] }
}
export const shipCategories = ['All vessels', 'Container', 'Dry bulk', 'General cargo', 'Ro-ro', 'Tankers']
export const parseActivity = (value: unknown): ActivityStudy => validatePortwatch(value) as ActivityStudy
export const dailyValue = (location: ActivityLocation, index: number, metric: Metric, category: number): number | null => location.days[index]?.[metric]?.[category] ?? null
export function mean(values: (number | null)[]): number | null {
  if (!values.length || values.some(value => value === null)) return null
  return (values as number[]).reduce((sum, value) => sum + value, 0) / values.length
}
export function trailingMean(location: ActivityLocation, index: number, metric: Metric, category: number): number | null {
  if (index < 6) return null
  return mean(Array.from({ length: 7 }, (_, n) => dailyValue(location, index - 6 + n, metric, category)))
}
export function baselineMean(study: ActivityStudy, location: ActivityLocation, metric: Metric, category: number): number | null {
  const values = study.dates.flatMap((date, i) => date >= study.baseline.start && date <= study.baseline.end ? [dailyValue(location, i, metric, category)] : [])
  return values.length === study.baseline.days ? mean(values) : null
}
export function relativeChange(value: number | null, baseline: number | null): number | null {
  return value === null || baseline === null || baseline === 0 ? null : (value / baseline - 1) * 100
}
/** Separate SVG subpaths preserve missing days instead of joining across them. */
export function seriesPath(values: (number | null)[], width: number, height: number, max: number): string {
  let gap = true
  return values.map((value, i) => {
    if (value === null) { gap = true; return '' }
    const command = gap ? 'M' : 'L'; gap = false
    return `${command}${(i / Math.max(1, values.length - 1) * width).toFixed(2)},${(height - value / Math.max(1, max) * height).toFixed(2)}`
  }).join(' ')
}
