import { readdirSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
const assets = readdirSync('dist/assets').filter(name => /\.(js|css)$/.test(name))
const publicData = readdirSync('dist/data').sort()
if (JSON.stringify(publicData) !== JSON.stringify(['demo', 'demo-study.json', 'land.geojson', 'port-statistics.json', 'ports.json'])) throw new Error('Unexpected public data: observed samples and provider downloads must stay local.')
const appBytes = assets.reduce((total, name) => total + gzipSync(readFileSync(`dist/assets/${name}`)).length, 0)
for (const name of assets.filter(name => name.endsWith('.js'))) {
  if (readFileSync(`dist/assets/${name}`, 'utf8').includes('/__local/')) throw new Error('Local review endpoints must be eliminated from the production client.')
}
if (appBytes > 150 * 1024) throw new Error(`Application exceeds 150 KiB compressed: ${appBytes}`)
const manifest = JSON.parse(readFileSync('dist/data/demo-study.json', 'utf8'))
if (manifest.kind !== 'track-manifest' || manifest.source.evidence !== 'synthetic' || manifest.source.publication !== 'synthetic-only') throw new Error('Only the synthetic chunk manifest is admitted to this prototype.')
if (manifest.id !== 'manifest-synthetic-v4' || manifest.vesselCount !== 60_000 || manifest.chunks.length !== 30) throw new Error('Expected the 60,000-vessel, 30-day chunked fixture.')
const expected = [manifest.catalogue, ...manifest.chunks]
const actual = readdirSync('dist/data/demo').map(name => `demo/${name}`).sort()
if (JSON.stringify(actual) !== JSON.stringify(expected.map(asset => asset.path).sort())) throw new Error('Unexpected or missing movement chunks.')
const sizes = expected.map(asset => {
  if (!/^demo\/(vessels|day-\d{2})-[a-f0-9]{12}\.json$/.test(asset.path)) throw new Error('Invalid chunk path.')
  const bytes = readFileSync(`dist/data/${asset.path}`)
  if (bytes.length !== asset.bytes || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error(`Chunk integrity mismatch: ${asset.path}`)
  const payload = JSON.parse(bytes)
  if (JSON.stringify(payload.source) !== JSON.stringify(manifest.source) || payload.studyId !== manifest.id) throw new Error('Chunk source mismatch.')
  if (bytes.length > 8 * 1024 * 1024) throw new Error('Chunk/catalogue exceeds 8 MiB decoded.')
  return { decoded: bytes.length, gzip: gzipSync(bytes).length }
})
const contextBytes = publicData.filter(name => name !== 'demo').reduce((sum, name) => sum + gzipSync(readFileSync(`dist/data/${name}`)).length, 0)
const worstChunk = Math.max(...sizes.slice(1).map(size => size.gzip))
const initialBytes = contextBytes + sizes[0].gzip + worstChunk
const residentBytes = sizes[0].decoded + sizes.slice(1).map(size => size.decoded).sort((a,b) => b-a).slice(0,2).reduce((a,b) => a+b, 0)
// Loading now has separate first-view, per-chunk, and bounded working-set gates.
if (worstChunk > 1.5 * 1024 * 1024) throw new Error('A daily chunk exceeds 1.5 MiB gzip.')
if (initialBytes > 2 * 1024 * 1024) throw new Error('First view exceeds 2 MiB gzip.')
if (residentBytes > 24 * 1024 * 1024) throw new Error('Catalogue plus two chunks exceeds 24 MiB decoded JSON.')
console.log(`Application: ${(appBytes / 1024).toFixed(1)} KiB gzip; worst first view: ${(initialBytes / 1024 / 1024).toFixed(2)} MiB gzip; largest day: ${(worstChunk / 1024 / 1024).toFixed(2)} MiB gzip; catalogue + two days: ${(residentBytes / 1024 / 1024).toFixed(2)} MiB decoded JSON.`)
console.log(`60,000 vessels; ${manifest.sampleCount.toLocaleString('en-US')} original samples; 30 demand-loaded days; archive ${(sizes.reduce((sum,s) => sum+s.gzip,contextBytes)/1024/1024).toFixed(2)} MiB gzip including duplicated trail halos.`)
if (initialBytes > 1.5 * 1024 * 1024) console.warn(`OVER DELIVERY TARGET: ${(initialBytes / (1.5 * 1024 * 1024)).toFixed(2)}× the original 1.5 MiB first-view target; the current chunked benchmark ceiling is 2 MiB.`)
