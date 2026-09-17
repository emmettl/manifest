import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { compileLocation, daysBetween, validatePortwatch } from './portwatch-core.mjs'

// An authored, finite capture. No credentials, recurring collector, or browser API calls.
const start = '2023-11-01', end = '2024-03-31'
const ports = ['port1188', 'port1201', 'port1114', 'port744', 'port192', 'port311', 'port254', 'port1160']
const chokepoints = ['chokepoint1', 'chokepoint4', 'chokepoint7', 'chokepoint2', 'chokepoint5', 'chokepoint6', 'chokepoint8', 'chokepoint9']
const root = 'https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/'
const raw = 'data/raw/portwatch-2023-2024'
await mkdir(raw, { recursive: true }); await mkdir('data/compiled', { recursive: true })
const offline = process.argv.includes('--offline')
const sources = []
async function capture(name, url) {
  const path = `${raw}/${name}.json`
  let envelope
  if (offline) envelope = JSON.parse(await readFile(path, 'utf8'))
  else {
    const response = await fetch(url, { signal: AbortSignal.timeout(45_000) })
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`)
    const body = await response.text()
    const parsed = JSON.parse(body)
    if (parsed.error) throw new Error(`${name}: ${JSON.stringify(parsed.error)}`)
    envelope = { url, retrievedUtc: new Date().toISOString(), sha256: createHash('sha256').update(body).digest('hex'), body }
    await writeFile(`${path}.tmp`, JSON.stringify(envelope)); await rename(`${path}.tmp`, path)
  }
  if (envelope.url !== url || envelope.sha256 !== createHash('sha256').update(envelope.body).digest('hex')) throw new Error(`Source integrity failure: ${name}`)
  sources.push({ file: `${name}.json`, url, retrievedUtc: envelope.retrievedUtc, sha256: envelope.sha256 })
  return JSON.parse(envelope.body)
}
async function query(name, service, where) {
  const rows = []
  for (let offset = 0; offset < 20_000; offset += 1000) {
    const params = new URLSearchParams({ where, outFields: '*', returnGeometry: 'false', orderByFields: 'ObjectId ASC', resultOffset: String(offset), resultRecordCount: '1000', f: 'json' })
    const data = await capture(`${name}-${offset}`, `${root}${service}/FeatureServer/0/query?${params}`)
    if (!Array.isArray(data.features)) throw new Error(`Missing features: ${name}`)
    rows.push(...data.features.map(f => f.attributes))
    if (!data.exceededTransferLimit) return rows
    if (!data.features.length) throw new Error('Pagination made no progress')
  }
  throw new Error('Bounded query exceeded 20 pages')
}
const locations = [], dates = daysBetween(start, end)
for (const [kind, ids, table, metaTable, item] of [
  ['chokepoint', chokepoints, 'Daily_Chokepoints_Data', 'PortWatch_chokepoints_database', '3da2b9ca97684916b75c4013f95d18ab'],
  ['port', ports, 'Daily_Ports_Data', 'PortWatch_ports_database', '83b1bbc7b3354c5fb1f40673bb8f852e'],
]) {
  await capture(`${kind}-item`, `https://www.arcgis.com/sharing/rest/content/items/${item}?f=json`)
  await capture(`${kind}-schema`, `${root}${table}/FeatureServer/0?f=json`)
  const where = `portid IN (${ids.map(id => `'${id}'`).join(',')})`
  const metadata = await query(`${kind}-locations`, metaTable, where)
  const rows = await query(`${kind}-days`, table, `${where} AND date >= DATE '${start}' AND date <= DATE '${end}'`)
  for (const id of ids) {
    const matches = metadata.filter(m => m.portid === id)
    if (matches.length !== 1) throw new Error(`Expected one location for ${id}`)
    locations.push(compileLocation(matches[0], kind, rows.filter(r => r.portid === id), dates))
  }
  console.log(`${kind}: ${metadata.length} locations, ${rows.length} source days`)
}
const study = validatePortwatch({
  schemaVersion: 1, kind: 'portwatch-activity', id: 'portwatch-red-sea-2023-2024', start, end, dates,
  source: { id: 'imf-portwatch', evidence: 'ais-derived-aggregate', publication: 'local-review', url: 'https://portwatch.imf.org/', attribution: 'Sources: UN Global Platform; IMF PortWatch (portwatch.imf.org).', terms: 'https://www.imf.org/en/about/copyright-and-terms', capturedUtc: sources[0].retrievedUtc, snapshots: sources },
  baseline: { start: '2023-11-01', end: '2023-11-30', days: 30 },
  locations,
  audit: { locations: locations.length, expectedDays: locations.length * dates.length, availableDays: locations.reduce((n, l) => n + l.days.filter(Boolean).length, 0), missingDays: locations.flatMap(l => l.days.flatMap((d, i) => d ? [] : [`${l.id}/${dates[i]}`])) },
})
const json = JSON.stringify(study)
await writeFile('data/compiled/portwatch-study.json.tmp', json)
await rename('data/compiled/portwatch-study.json.tmp', 'data/compiled/portwatch-study.json')
console.log(JSON.stringify({ ...study.audit, bytes: Buffer.byteLength(json), gzipBytes: gzipSync(json).length }, null, 2))
