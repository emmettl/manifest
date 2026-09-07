import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'

const wrap = n => ((n + 180) % 360 + 360) % 360 - 180
function distanceKm(a, b) {
  const rad = Math.PI / 180
  const lat = (b.latitude - a.latitude) * rad
  const lon = wrap(b.longitude - a.longitude) * rad
  const h = Math.sin(lat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(lon / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(Math.min(1, h)))
}

/** Compile normalized reports; provider adapters and publication approval remain edition-owned. */
export function compileReports(input, { maxGapSeconds = 21600, maxSpeedKnots = 45, bounds } = {}) {
  if (!Number.isFinite(maxGapSeconds) || maxGapSeconds <= 0 || !Number.isFinite(maxSpeedKnots) || maxSpeedKnots <= 0) throw new Error('Quality thresholds must be positive.')
  if (bounds && (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isFinite) || bounds[0] >= bounds[2] || bounds[1] >= bounds[3] || bounds[0] < -180 || bounds[2] > 180 || bounds[1] < -90 || bounds[3] > 90)) throw new Error('Expected non-dateline-crossing [west, south, east, north] bounds.')
  const epoch = Date.parse(input.startUtc) / 1000
  if (!Number.isFinite(epoch) || !Number.isFinite(input.duration) || input.duration <= 0 || !Array.isArray(input.reports)) throw new Error('Expected startUtc, positive duration and a reports array.')
  if (!input.source?.id || !input.source?.label || !input.source?.license) throw new Error('Source identity and license metadata are required.')
  const audit = { received: input.reports.length, rejected: 0, duplicates: 0, conflicts: 0, gapSplits: 0, speedSplits: 0, outsideBounds: 0, classSplits: 0 }
  const gaps = [], speeds = []
  const groups = new Map()
  for (const report of input.reports) {
    if (!/^\d{9}$/.test(String(report.mmsi)) || !Number.isFinite(report.timestamp) || !Number.isFinite(report.longitude) || !Number.isFinite(report.latitude) || Math.abs(report.longitude) > 180 || Math.abs(report.latitude) > 90 || report.timestamp < epoch || report.timestamp > epoch + input.duration) { audit.rejected++; continue }
    const id = `${input.source.id}:${report.mmsi}`
    if (!groups.has(id)) groups.set(id, [])
    groups.get(id).push(report)
  }
  const vessels = [], segments = []
  for (const [id, reports] of groups) {
    reports.sort((a, b) => a.timestamp - b.timestamp)
    let previous = null, samples = [], count = 0, vesselId = id, category = null
    const flush = () => { if (samples.length) segments.push({ id: `${id}:${count++}`, vesselId, samples }); samples = [] }
    for (let i = 0; i < reports.length; i++) {
      const report = reports[i]
      const simultaneous = [report]
      while (reports[i + 1]?.timestamp === report.timestamp) simultaneous.push(reports[++i])
      if (simultaneous.some(other => other.longitude !== report.longitude || other.latitude !== report.latitude || (other.category ?? 'other') !== (report.category ?? 'other'))) {
        audit.conflicts += simultaneous.length; flush(); previous = null; continue
      }
      audit.duplicates += simultaneous.length - 1
      if (bounds && (report.longitude < bounds[0] || report.longitude > bounds[2] || report.latitude < bounds[1] || report.latitude > bounds[3])) { audit.outsideBounds++; flush(); previous = null; continue }
      const nextCategory = ['cargo', 'tanker'].includes(report.category) ? report.category : 'other'
      if (nextCategory !== category) {
        flush()
        if (category !== null) { audit.classSplits++; vesselId = `${id}@${report.timestamp}` }
        category = nextCategory
        vessels.push({ id: vesselId, label: `Observed ${category === 'other' ? 'vessel' : category} · ${report.mmsi}${vesselId === id ? '' : ` · ${new Date(report.timestamp * 1000).toISOString().slice(5, 16)}`}`, category, evidence: 'observed' })
      }
      if (previous) {
        const delta = report.timestamp - previous.timestamp
        const speed = distanceKm(previous, report) / (delta / 3600) / 1.852
        gaps.push(delta); speeds.push(speed)
        if (delta > maxGapSeconds) { audit.gapSplits++; flush() }
        else if (speed > maxSpeedKnots) { audit.speedSplits++; flush() }
      }
      samples.push({ time: report.timestamp - epoch, position: [report.longitude, report.latitude] })
      previous = report
    }
    flush()
  }
  const distribution = values => {
    values.sort((a, b) => a - b)
    const quantile = q => values.length ? values[Math.ceil((values.length - 1) * q)] : null
    return { count: values.length, p50: quantile(.5), p90: quantile(.9), p95: quantile(.95), p99: quantile(.99), max: quantile(1) }
  }
  return {
    schemaVersion: 1, kind: 'tracks', id: `${input.source.id}-compiled`, title: 'Regional AIS compiler proof',
    startUtc: input.startUtc, duration: input.duration,
    source: { ...input.source, evidence: 'observed', publication: 'review-required' }, vessels, segments,
    audit: { ...audit, maxGapSeconds, maxSpeedKnots, ...(bounds ? { bounds } : {}), gapsSeconds: distribution(gaps), apparentSpeedKnots: distribution(speeds), gapThresholdCounts: Object.fromEntries([120, 300, 600, 1800, 3600, 21600].map(threshold => [threshold, gaps.filter(gap => gap > threshold).length])), inputSha256: createHash('sha256').update(JSON.stringify(input)).digest('hex') },
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [, , inputPath, outputPath] = process.argv
  if (!inputPath || !outputPath) throw new Error('Usage: npm run data:compile -- data/raw/normalized.json data/compiled/study.json')
  const output = resolve(outputPath)
  const publicRoot = resolve('public')
  if (output === publicRoot || output.startsWith(publicRoot + sep)) throw new Error('Compile into data/compiled; publication requires a separate source-rights review.')
  const study = compileReports(JSON.parse(readFileSync(inputPath, 'utf8')))
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, JSON.stringify(study) + '\n')
  console.log(JSON.stringify(study.audit, null, 2))
}
