import { readdirSync, readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
const assets = readdirSync('dist/assets').filter(name => /\.(js|css)$/.test(name))
const publicData = readdirSync('dist/data').sort()
if (JSON.stringify(publicData) !== JSON.stringify(['demo-study.json', 'land.geojson', 'port-statistics.json', 'ports.json'])) throw new Error('Unexpected public data: observed samples and provider downloads must stay local.')
const appBytes = assets.reduce((total, name) => total + gzipSync(readFileSync(`dist/assets/${name}`)).length, 0)
for (const name of assets.filter(name => name.endsWith('.js'))) {
  if (readFileSync(`dist/assets/${name}`, 'utf8').includes('/__local/')) throw new Error('Local review endpoints must be eliminated from the production client.')
}
const fieldBytes = publicData.reduce((total, name) => total + gzipSync(readFileSync(`dist/data/${name}`)).length, 0)
if (appBytes > 150 * 1024) throw new Error(`Application exceeds 150 KiB compressed: ${appBytes}`)
if (fieldBytes > 1.5 * 1024 * 1024) throw new Error(`Initial field exceeds 1.5 MiB compressed: ${fieldBytes}`)
const study = JSON.parse(readFileSync('dist/data/demo-study.json', 'utf8'))
if (study.source.evidence !== 'synthetic' || study.source.publication !== 'synthetic-only') throw new Error('Only the synthetic fixture is admitted to this prototype.')
console.log(`Application: ${(appBytes / 1024).toFixed(1)} KiB gzip; initial field + land: ${(fieldBytes / 1024).toFixed(1)} KiB gzip.`)
