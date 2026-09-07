import { readdirSync, readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
const assets = readdirSync('dist/assets').filter(name => /\.(js|css)$/.test(name))
const appBytes = assets.reduce((total, name) => total + gzipSync(readFileSync(`dist/assets/${name}`)).length, 0)
const fieldBytes = ['demo-study.json', 'land.geojson'].reduce((total, name) => total + gzipSync(readFileSync(`dist/data/${name}`)).length, 0)
if (appBytes > 150 * 1024) throw new Error(`Application exceeds 150 KiB compressed: ${appBytes}`)
if (fieldBytes > 1.5 * 1024 * 1024) throw new Error(`Initial field exceeds 1.5 MiB compressed: ${fieldBytes}`)
const study = JSON.parse(readFileSync('dist/data/demo-study.json', 'utf8'))
if (study.source.evidence !== 'synthetic' || study.source.publication !== 'synthetic-only') throw new Error('Only the synthetic fixture is admitted to this prototype.')
console.log(`Application: ${(appBytes / 1024).toFixed(1)} KiB gzip; initial field + land: ${(fieldBytes / 1024).toFixed(1)} KiB gzip.`)
