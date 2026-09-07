import { writeFileSync } from 'node:fs'

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
const DAY = 86400
const wrap = n => ((n + 180) % 360 + 360) % 360 - 180
let seed = 9173
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
const vessels = [], segments = []
for (let i = 0; i < 420; i++) {
  const routeIndex = i % routes.length
  const route = [...routes[routeIndex]]
  if (i % 3 === 0) route.reverse()
  const id = `demo-${String(i + 1).padStart(3, '0')}`
  const category = routeIndex === 2 || routeIndex === 3 ? 'tanker' : 'cargo'
  const duration = (12 + random() * 18) * DAY
  const start = (-22 + random() * 52) * DAY
  const lengths = route.map((point, index) => index === 0 ? 0 : Math.hypot(wrap(point[0] - route[index - 1][0]) * Math.cos(point[1] * Math.PI / 180), point[1] - route[index - 1][1]))
  const total = lengths.reduce((a, b) => a + b, 0)
  let travelled = 0
  const offset = (random() - .5) * .15
  const samples = route.map((point, index) => {
    travelled += lengths[index]
    return { time: Math.round(start + duration * travelled / total), position: [Number(wrap(point[0] + offset).toFixed(4)), Number((point[1] + offset).toFixed(4))] }
  })
  vessels.push({ id, label: `${category === 'tanker' ? 'Tanker' : 'Cargo'} ${String(i + 1).padStart(3, '0')}`, category, evidence: 'synthetic' })
  segments.push({ id: `${id}-segment-1`, vesselId: id, samples })
}
const study = {
  schemaVersion: 1, kind: 'tracks', id: 'manifest-synthetic-v1', title: 'MANIFEST development fixture',
  startUtc: '2026-01-01T00:00:00Z', duration: 30 * DAY,
  source: { id: 'authored-demo-v1', label: 'Deterministic synthetic fixture', evidence: 'synthetic', license: 'CC0-1.0', publication: 'synthetic-only' },
  vessels, segments,
}
writeFileSync(new URL('../public/data/demo-study.json', import.meta.url), JSON.stringify(study) + '\n')
console.log(`Generated ${vessels.length} synthetic vessels; no observed AIS data.`)
