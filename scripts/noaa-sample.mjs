import { createReadStream, createWriteStream, existsSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { pipeline } from 'node:stream/promises'
import { Readable, Transform } from 'node:stream'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { compileReports } from './compile-ais.mjs'
import { createOperatorLookup, normalizeImo } from '../src/maritime/operator-attribution.mjs'

export const sample = {
  id: 'noaa-la-2025', startUtc: '2025-01-01T00:00:00Z', duration: 3 * 86400,
  bounds: [-120, 32.5, -117, 34.5], // west, south, east, north; regional approaches, not port calls.
  dates: ['2025-01-01', '2025-01-02', '2025-01-03'],
  metadataUrl: 'https://www.fisheries.noaa.gov/inport/item/77594/full-list',
  baseUrl: 'https://noaaocm.blob.core.windows.net/ais/csv2/csv2025/',
  landUrl: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_land.geojson',
}
const rawDirectory = resolve('data/raw/noaa-2025')
const compiledDirectory = resolve('data/compiled')

// NOAA documents replacing embedded commas in text fields. Still handle quoted CSV fields,
// escaped quotes, reordered columns and CRLF; reject malformed/multiline rows explicitly.
export function csvFields(line) {
  const fields = []; let field = '', quoted = false, closed = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (quoted) {
      if (char === '"') { if (line[i + 1] === '"') { field += '"'; i++ } else { quoted = false; closed = true } }
      else field += char
    } else if (char === ',') { fields.push(field); field = ''; closed = false }
    else if (char === '"' && !field && !closed) quoted = true
    else { if (closed || char === '"') throw new Error('Malformed NOAA CSV row'); field += char }
  }
  if (quoted) throw new Error('Unterminated NOAA CSV field')
  fields.push(field)
  return fields
}

export function noaaColumns(line) {
  const names = csvFields(line.replace(/^\uFEFF/, '')).map(name => name.trim().toLowerCase())
  const required = ['mmsi', 'base_date_time', 'longitude', 'latitude', 'vessel_type']
  if (new Set(names).size !== names.length || required.some(name => !names.includes(name))) throw new Error('Expected NOAA 2025 CSV columns; do not guess coordinate order.')
  return Object.fromEntries(names.map((name, index) => [name, index]))
}

export function normalizeNoaaRow(line, columns) {
  const fields = csvFields(line)
  if (fields.length !== Object.keys(columns).length) throw new Error('Wrong number of NOAA CSV fields')
  const get = name => fields[columns[name]].trim()
  const number = name => get(name) === '' ? NaN : Number(get(name))
  const date = get('base_date_time')
  // NOAA's timezone-free exported date is explicitly UTC. Never use host-local parsing.
  const timestamp = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(date) ? Date.parse(date.replace(' ', 'T') + 'Z') / 1000 : NaN
  const vesselType = number('vessel_type')
  const imo = normalizeImo(columns.imo === undefined ? undefined : get('imo'))
  const reportedName = columns.vessel_name === undefined ? '' : get('vessel_name')
  return {
    mmsi: get('mmsi'), timestamp: Number.isFinite(timestamp) && new Date(timestamp * 1000).toISOString().slice(0, 19) === date.replace(' ', 'T') ? timestamp : NaN, longitude: number('longitude'), latitude: number('latitude'),
    category: Number.isInteger(vesselType) && vesselType >= 70 && vesselType <= 79 ? 'cargo' : Number.isInteger(vesselType) && vesselType >= 80 && vesselType <= 89 ? 'tanker' : 'other',
    ...(imo ? { imo } : {}), ...(reportedName ? { reportedName } : {}),
  }
}

export const inside = (report, [west, south, east, north]) => report.longitude >= west && report.longitude <= east && report.latitude >= south && report.latitude <= north

export function selectReview(study) {
  const vessels = study.vessels.filter(vessel => ['cargo', 'tanker'].includes(vessel.category))
  const ids = new Set(vessels.map(vessel => vessel.id))
  const segments = study.segments.filter(segment => ids.has(segment.vesselId))
  return { ...study, vessels, segments, selection: {
    categories: ['cargo', 'tanker'], vessels: vessels.length, segments: segments.length,
    samples: segments.reduce((sum, segment) => sum + segment.samples.length, 0),
    omittedVessels: study.vessels.length - vessels.length,
    policy: 'Retain every received sample in cargo/tanker class episodes. No downsampling. Audit distributions describe all regional classes before this display selection.',
  } }
}

// Select whole polygons, preserving rings and topology. This is not a geometrical clip.
export function selectLand(land, bounds = [-123, 30, -115, 37]) {
  const features = []
  for (const feature of land.features) {
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates
    for (const polygon of polygons) {
      let west = 180, south = 90, east = -180, north = -90
      for (const [x, y] of polygon[0]) { west = Math.min(west, x); south = Math.min(south, y); east = Math.max(east, x); north = Math.max(north, y) }
      if (west <= bounds[2] && east >= bounds[0] && south <= bounds[3] && north >= bounds[1]) features.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: polygon } })
    }
  }
  return { type: 'FeatureCollection', features }
}

export async function prepareLand({ acquire = false } = {}) {
  const path = resolve(rawDirectory, 'ne_10m_land.geojson')
  if (!existsSync(path)) {
    if (!acquire) throw new Error('Missing detailed land geometry; run npm run data:noaa -- --download.')
    const response = await fetch(sample.landUrl)
    if (!response.ok) throw new Error(`Natural Earth download failed: ${response.status}`)
    await writeFile(path, await response.text())
  }
  const land = selectLand(JSON.parse(await readFile(path, 'utf8')))
  const output = resolve(compiledDirectory, 'noaa-la-land.geojson')
  await writeFile(output, JSON.stringify(land) + '\n')
  const provenance = { sourceUrl: sample.landUrl, license: 'Public domain', termsUrl: 'https://www.naturalearthdata.com/about/terms-of-use/', scale: '1:10 million', selectionBounds: [-123, 30, -115, 37], transformation: 'Whole polygons whose outer-ring bounds intersect the selection, unchanged coordinates and holes. Regional context only; no navigation claim.', inputSha256: await digest(path, 'sha256'), outputSha256: await digest(output, 'sha256') }
  await writeFile(resolve(compiledDirectory, 'noaa-la-land.source.json'), JSON.stringify(provenance, null, 2) + '\n')
  return provenance
}

async function digest(path, algorithm, encoding = 'hex') {
  const hash = createHash(algorithm)
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest(encoding)
}

async function download(url, destination) {
  const response = await fetch(url)
  if (!response.ok || !response.body) throw new Error(`NOAA download failed: ${response.status}`)
  const length = Number(response.headers.get('content-length'))
  const md5 = response.headers.get('content-md5')
  let bytes = 0
  const hash = createHash('md5')
  await pipeline(Readable.fromWeb(response.body), new Transform({ transform(chunk, _encoding, callback) { bytes += chunk.length; hash.update(chunk); callback(null, chunk) } }), createWriteStream(destination + '.partial'))
  if ((length && length !== bytes) || (md5 && hash.digest('base64') !== md5)) throw new Error('Incomplete or corrupt NOAA download; retained .partial for diagnosis.')
  await rename(destination + '.partial', destination)
  await writeFile(destination.replace('.csv.zst', '.headers'), [...response.headers].map(([key, value]) => `${key}: ${value}`).join('\n') + '\n')
}

async function* rows(path) {
  const child = spawn('zstd', ['--decompress', '--stdout', '--quiet', path], { stdio: ['ignore', 'pipe', 'pipe'] })
  let errorText = ''
  child.stderr.on('data', chunk => { errorText += chunk })
  const completed = new Promise((accept, reject) => {
    child.on('error', reject)
    child.on('close', code => code === 0 ? accept() : reject(new Error(`zstd failed (${code}): ${errorText}`)))
  })
  // Handle subprocess failure even when it happens before the row iterator finishes.
  completed.catch(() => {})
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity })
  let columns = null
  try {
    for await (const line of lines) {
      if (!columns) { columns = noaaColumns(line); continue }
      if (line) yield normalizeNoaaRow(line, columns)
    }
    await completed
    if (!columns) throw new Error('Empty NOAA archive')
  } finally { lines.close(); if (child.exitCode === null) child.kill() }
}

export async function buildSample({ acquire = false, operatorsPath } = {}) {
  const operatorRegistry = operatorsPath ? JSON.parse(await readFile(resolve(operatorsPath), 'utf8')) : undefined
  createOperatorLookup(operatorRegistry) // Fail before scanning/downloading on bad or overlapping evidence.
  await mkdir(rawDirectory, { recursive: true }); await mkdir(compiledDirectory, { recursive: true })
  const geography = await prepareLand({ acquire })
  const archives = []
  for (const date of sample.dates) {
    const file = `ais-${date}.csv.zst`, path = resolve(rawDirectory, file), url = sample.baseUrl + file
    if (!existsSync(path)) {
      if (!acquire) throw new Error(`Missing ${path}. Run with --download to acquire the fixed three-day NOAA sample.`)
      console.log(`Downloading ${file}`); await download(url, path)
    }
    const headers = await readFile(path.replace('.csv.zst', '.headers'), 'utf8')
    const bytes = (await stat(path)).size
    const length = headers.match(/^content-length:\s*(\d+)/im)?.[1]
    const md5 = headers.match(/^content-md5:\s*(\S+)/im)?.[1]
    if ((length && Number(length) !== bytes) || (md5 && await digest(path, 'md5', 'base64') !== md5)) throw new Error(`Incomplete or corrupt archive: ${file}`)
    archives.push({ file, url, bytes, sha256: await digest(path, 'sha256'), etag: headers.match(/^etag:\s*(.+)/im)?.[1].trim(), lastModified: headers.match(/^last-modified:\s*(.+)/im)?.[1].trim() })
  }
  if (acquire) {
    const response = await fetch(sample.metadataUrl)
    if (!response.ok) throw new Error(`Metadata snapshot failed: ${response.status}`)
    await writeFile(resolve(rawDirectory, 'metadata.html'), await response.text())
  }
  const metadataPath = resolve(rawDirectory, 'metadata.html')
  if (!existsSync(metadataPath)) throw new Error('Missing metadata.html; acquire the NOAA metadata alongside the archives.')
  const cohort = new Set(); let scanned = 0, inBounds = 0
  const epoch = Date.parse(sample.startUtc) / 1000
  for (const archive of archives) {
    console.log(`Finding regional vessels in ${archive.file}`)
    for await (const report of rows(resolve(rawDirectory, archive.file))) {
      scanned++
      if (/^\d{9}$/.test(report.mmsi) && report.timestamp >= epoch && report.timestamp < epoch + sample.duration && inside(report, sample.bounds)) { cohort.add(report.mmsi); inBounds++ }
    }
  }
  // Second pass keeps the cohort's out-of-region observations too, so leaving and
  // re-entering the box cannot produce a false interpolated track through the region.
  const reports = []
  for (const archive of archives) {
    console.log(`Reading regional cohort from ${archive.file}`)
    for await (const report of rows(resolve(rawDirectory, archive.file))) if (cohort.has(report.mmsi)) reports.push(report)
  }
  const provenance = {
    metadataUrl: sample.metadataUrl, metadataSha256: await digest(metadataPath, 'sha256'), metadataRetrievedUtc: (await stat(metadataPath)).mtime.toISOString(), archives, geography,
    bounds: sample.bounds, scanned, inBounds, cohortMmsis: cohort.size,
    classification: 'NOAA per-row vessel_type, including AVID enrichment. Class episodes follow changes in the supplied rows; historical registry validity is not established. No cargo-content inference.',
    coverage: 'US coastal receiver observations; clipped to LA/Long Beach approaches. Jan 1–3 is a holiday sample, not a representative traffic baseline. Out-of-box observations break tracks.',
  }
  const input = {
    source: { id: sample.id, label: 'NOAA / BOEM / USCG · LA approaches · 1–3 Jan 2025', license: 'NOAA InPort 77594: access constraints None; use constraints For coastal and ocean planning. Public artwork redistribution review outstanding.', url: sample.metadataUrl, classification: provenance.classification },
    startUtc: sample.startUtc, duration: sample.duration, reports, provenance, ...(operatorRegistry ? { operatorRegistry } : {}),
  }
  const study = compileReports(input, { bounds: sample.bounds, maxGapSeconds: 600, maxSpeedKnots: 45 })
  study.title = 'Los Angeles approaches · 72 hours of observed AIS'
  study.provenance = provenance
  await writeFile(resolve(rawDirectory, 'normalized.json'), JSON.stringify(input) + '\n')
  await writeFile(resolve(compiledDirectory, sample.id + '.full.json'), JSON.stringify(study) + '\n')
  const review = selectReview(study)
  await writeFile(resolve(compiledDirectory, sample.id + '.json'), JSON.stringify(review) + '\n')
  // Private research inventory; supplied names/IMOs are leads, not operator evidence.
  const identities = new Map()
  for (const vessel of review.vessels) {
    const key = `${vessel.mmsi}:${vessel.imo ?? ''}:${vessel.reportedName ?? ''}`
    if (!identities.has(key)) identities.set(key, { mmsi: vessel.mmsi, imo: vessel.imo ?? null, reportedName: vessel.reportedName ?? null })
  }
  await writeFile(resolve(compiledDirectory, sample.id + '.identities.json'), JSON.stringify({ source: study.source, startUtc: study.startUtc, duration: study.duration, note: 'Source-supplied identities for researching dated commercial operators. Not a verified fleet mapping.', identities: [...identities.values()] }, null, 2) + '\n')
  const audit = { source: study.source, startUtc: sample.startUtc, duration: sample.duration, provenance, ...study.audit, vessels: study.vessels.length, segments: study.segments.length, samples: study.segments.reduce((sum, segment) => sum + segment.samples.length, 0), categories: Object.fromEntries(['cargo', 'tanker', 'other'].map(category => [category, study.vessels.filter(vessel => vessel.category === category).length])) }
  const selectedMmsis = new Set(input.reports.filter(report => ['cargo', 'tanker'].includes(report.category)).map(report => report.mmsi))
  audit.selectedCohort = compileReports({ ...input, reports: input.reports.filter(report => selectedMmsis.has(report.mmsi)) }, { bounds: sample.bounds, maxGapSeconds: 600, maxSpeedKnots: 45 }).audit
  audit.selection = review.selection
  await writeFile(resolve(compiledDirectory, sample.id + '.audit.json'), JSON.stringify(audit, null, 2) + '\n')
  console.log(JSON.stringify(audit, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  let acquire = false, operatorsPath
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--download') acquire = true
    else if (args[i] === '--operators' && args[i + 1] && !args[i + 1].startsWith('--')) operatorsPath = args[++i]
    else throw new Error('Usage: node scripts/noaa-sample.mjs [--download] [--operators data/raw/operators.json]')
  }
  await buildSample({ acquire, operatorsPath })
}
