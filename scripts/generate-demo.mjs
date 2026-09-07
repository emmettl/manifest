import { mkdirSync, readdirSync, unlinkSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { sliceTrackWindow, encodeSegments, TRAIL_SECONDS } from './chunk-tracks.mjs'
import ports from '../public/data/ports.json' with { type: 'json' }

// Authored schematic sea passages. These are synthetic fixtures, never AIS observations.
const routes = [
  [[122,31],[123,28],[120,23],[114,17],[109,10],[105,3],[104,1],[101,3],[96,6],[88,6],[80,5],[72,9],[62,13],[52,13],[45,12.5],[43.5,13],[41,18],[38,23],[35,28],[32.5,30],[32.4,31.5],[28,34],[20,35],[12,37],[7,38],[0,37],[-5.5,36],[-10,37],[-11,45],[-5,49],[2,51],[4,52]],
  [[114,22],[114,19],[109,10],[105,3],[104,1],[101,3],[96,6],[88,6],[80,5],[72,9],[62,13],[52,13],[45,12.5],[43.5,13],[41,18],[38,23],[35,28],[32.5,30],[32.4,31.5],[28,34],[20,35],[12,37]],
  [[50.5,27],[52,26],[54,25.5],[56,26.5],[57,25.5],[60,23],[66,18],[74,10],[80,5],[88,6],[96,6],[101,3],[104,1],[105,3],[110,12],[114,19],[120,23],[122,31]],
  [[50.5,27],[52,26],[54,25.5],[56,26.5],[57,25.5],[60,23],[61,18],[56,14],[51,13],[45,12.5],[43.5,13],[41,18],[38,23],[35,28],[32.5,30],[32.4,31.5],[28,34],[20,35],[12,37]],
  [[122,31],[128,29],[140,32],[155,37],[175,42],[-170,43],[-153,40],[-138,36],[-125,32],[-119,33]],
  [[104,1],[105,-3],[104,-7],[97,-15],[80,-25],[60,-31],[40,-36],[23,-36],[16,-33],[7,-20],[-3,-2],[-16,15],[-20,30],[-12,43],[-5,49],[2,51],[4,52]],
  [[4,52],[2,51],[-5,49],[-14,47],[-25,44],[-40,41],[-55,39],[-68,38],[-74,40]],
]
// Explicit endpoint identities, including for reversed voyages.
const endpoints = [
  ['shanghai', 'rotterdam'], ['yantian', 'palermo'], ['jubail', 'shanghai'],
  ['jubail', 'palermo'], ['shanghai', 'los-angeles'], ['singapore', 'rotterdam'], ['rotterdam', 'new-york'],
]
const portById = new Map(ports.map(port => [port.id, port]))
const DAY = 86400
const wrap = n => ((n + 180) % 360 + 360) % 360 - 180
export function createDemoStudy() {
let seed = 9173
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
const vessels = [], segments = []
// Fleet-size workload; activity remains staggered across the 30-day window.
const vesselCount = 60_000
for (let i = 0; i < vesselCount; i++) {
  const routeIndex = i % routes.length
  let [originPortId, destinationPortId] = endpoints[routeIndex]
  const route = [portById.get(originPortId).position, ...routes[routeIndex].slice(1, -1), portById.get(destinationPortId).position]
  if (i % 3 === 0) { route.reverse(); [originPortId, destinationPortId] = [destinationPortId, originPortId] }
  const id = `demo-${String(i + 1).padStart(5, '0')}`
  const category = routeIndex === 2 || routeIndex === 3 ? 'tanker' : 'cargo'
  const duration = (12 + random() * 18) * DAY
  // Every member of the fleet has a voyage intersecting the study window.
  const start = -duration + random() * (30 * DAY + duration)
  const lengths = route.map((point, index) => index === 0 ? 0 : Math.hypot(wrap(point[0] - route[index - 1][0]) * Math.cos(point[1] * Math.PI / 180), point[1] - route[index - 1][1]))
  const total = lengths.reduce((a, b) => a + b, 0)
  let travelled = 0
  const offset = (random() - .5) * .15
  const samples = route.map((point, index) => {
    travelled += lengths[index]
    return { time: Math.round(start + duration * travelled / total), position: index === 0 || index === route.length - 1 ? [...point] : [Number(wrap(point[0] + offset).toFixed(4)), Number((point[1] + offset).toFixed(4))] }
  })
  vessels.push({ id, label: `${category === 'tanker' ? 'Tanker' : 'Cargo'} ${String(i + 1).padStart(5, '0')}`, category, evidence: 'synthetic' })
  segments.push({ id: `${id}-segment-1`, vesselId: id, originPortId, destinationPortId, samples })
}
const study = {
  schemaVersion: 1, kind: 'tracks', id: 'manifest-synthetic-v4', title: 'MANIFEST 60,000-vessel performance fixture',
  startUtc: '2026-01-01T00:00:00Z', duration: 30 * DAY,
  source: { id: 'authored-demo-v4', label: 'Deterministic synthetic fixture', evidence: 'synthetic', license: 'CC0-1.0', publication: 'synthetic-only' },
  vessels, segments,
}
return study
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
const study = createDemoStudy()
const { vessels, segments } = study
const directory = new URL('../public/data/demo/', import.meta.url)
mkdirSync(directory, { recursive: true })
// Remove only this generator's previous daily chunks; unexpected files still fail
// the publication boundary check rather than being silently swept away.
for (const name of readdirSync(directory)) if (/^day-\d{2}-[a-f0-9]{12}\.json$/.test(name) || /^vessels-[a-f0-9]{12}\.json$/.test(name)) unlinkSync(new URL(name, directory))
const writeAsset = (stem, value) => {
  const serialized = JSON.stringify(value) + '\n'
  const sha256 = createHash('sha256').update(serialized).digest('hex')
  const path = `demo/${stem}-${sha256.slice(0, 12)}.json`
  writeFileSync(new URL(`../public/data/${path}`, import.meta.url), serialized)
  return { path, sha256, bytes: Buffer.byteLength(serialized) }
}
const catalogue = writeAsset('vessels', { schemaVersion: 1, kind: 'vessel-catalogue', studyId: study.id, source: study.source, vessels })
const vesselIndices = new Map(vessels.map((vessel, index) => [vessel.id, index]))
const chunks = []
for (let index = 0; index < 30; index++) {
  const start = index * DAY, end = Math.min(study.duration, start + DAY)
  const window = sliceTrackWindow(study, start, end)
  const asset = writeAsset(`day-${String(index).padStart(2, '0')}`, { schemaVersion: 1, kind: 'track-chunk', studyId: study.id, source: study.source, index, segments: encodeSegments(window, vesselIndices) })
  chunks.push({ ...asset, start, end, segmentCount: window.length, sampleCount: window.reduce((sum, segment) => sum + segment.samples.length, 0) })
}
const { vessels: _vessels, segments: _segments, ...metadata } = study
const manifest = { ...metadata, kind: 'track-manifest', vesselCount: vessels.length, sampleCount: segments.reduce((sum, segment) => sum + segment.samples.length, 0), lookbackSeconds: TRAIL_SECONDS, catalogue, chunks }
const serialized = JSON.stringify(manifest) + '\n'
writeFileSync(new URL('../public/data/demo-study.json', import.meta.url), serialized)
const provenanceUrl = new URL('../docs/DATA-SOURCES.json', import.meta.url)
const provenance = JSON.parse(readFileSync(provenanceUrl, 'utf8'))
provenance.movement.sha256 = createHash('sha256').update(serialized).digest('hex')
provenance.movement.delivery = 'Daily track chunks and a vessel catalogue; content hashes and decoded byte lengths are recorded in the manifest. Three-day trail overlap retains original samples and segment boundaries.'
writeFileSync(provenanceUrl, JSON.stringify(provenance, null, 2) + '\n')
const samples = segments.reduce((sum, segment) => sum + segment.samples.length, 0)
const openingTime = 10.5 * DAY
const active = segments.filter(segment => segment.samples[0].time <= openingTime && segment.samples.at(-1).time >= openingTime).length
console.log(`Generated ${vessels.length.toLocaleString('en-US')} synthetic vessels, ${samples.toLocaleString('en-US')} samples; ${active.toLocaleString('en-US')} active at opening. No observed AIS data.`)

}
