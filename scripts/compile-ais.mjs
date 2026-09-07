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
export function compileReports(input, { maxGapSeconds = 21600, maxSpeedKnots = 45 } = {}) {
  if (!Number.isFinite(maxGapSeconds) || maxGapSeconds <= 0 || !Number.isFinite(maxSpeedKnots) || maxSpeedKnots <= 0) throw new Error('Quality thresholds must be positive.')
  const epoch = Date.parse(input.startUtc) / 1000
  if (!Number.isFinite(epoch) || !Number.isFinite(input.duration) || input.duration <= 0 || !Array.isArray(input.reports)) throw new Error('Expected startUtc, positive duration and a reports array.')
  if (!input.source?.id || !input.source?.label || !input.source?.license) throw new Error('Source identity and license metadata are required.')
  const audit = { received: input.reports.length, rejected: 0, duplicates: 0, conflicts: 0, gapSplits: 0, speedSplits: 0 }
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
    // Identity/class enrichment must be time-aligned in a future provider adapter.
    vessels.push({ id, label: 'Observed vessel', category: 'other', evidence: 'observed' })
    let previous = null, samples = [], count = 0
    const flush = () => { if (samples.length) segments.push({ id: `${id}:${count++}`, vesselId: id, samples }); samples = [] }
    for (let i = 0; i < reports.length; i++) {
      const report = reports[i]
      const simultaneous = [report]
      while (reports[i + 1]?.timestamp === report.timestamp) simultaneous.push(reports[++i])
      if (simultaneous.some(other => other.longitude !== report.longitude || other.latitude !== report.latitude)) {
        audit.conflicts += simultaneous.length; flush(); previous = null; continue
      }
      audit.duplicates += simultaneous.length - 1
      if (previous) {
        const delta = report.timestamp - previous.timestamp
        const speed = distanceKm(previous, report) / (delta / 3600) / 1.852
        if (delta > maxGapSeconds) { audit.gapSplits++; flush() }
        else if (speed > maxSpeedKnots) { audit.speedSplits++; flush() }
      }
      samples.push({ time: report.timestamp - epoch, position: [report.longitude, report.latitude] })
      previous = report
    }
    flush()
  }
  return {
    schemaVersion: 1, kind: 'tracks', id: `${input.source.id}-compiled`, title: 'Regional AIS compiler proof',
    startUtc: input.startUtc, duration: input.duration,
    source: { ...input.source, evidence: 'observed', publication: 'review-required' }, vessels, segments,
    audit: { ...audit, maxGapSeconds, maxSpeedKnots, inputSha256: createHash('sha256').update(JSON.stringify(input)).digest('hex') },
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
