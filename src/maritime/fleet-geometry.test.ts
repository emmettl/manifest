import { describe, expect, it } from 'vitest'
import { EDGE_FLOATS, FleetHeads, packFleetEdges, type FleetView } from './fleet-geometry'
import type { TrackStudy } from './types'

const study: TrackStudy = {
  schemaVersion: 1, kind: 'tracks', id: 'test', title: 'Test', startUtc: '2025-01-01T00:00:00Z', duration: 100,
  source: { id: 'test', label: 'Test', evidence: 'synthetic', license: 'CC0', publication: 'synthetic-only' },
  vessels: [{ id: 'v', label: 'Test', category: 'cargo', evidence: 'synthetic' }],
  segments: [
    { id: 'a', vesselId: 'v', samples: [{ time: 10, position: [179, 0] }, { time: 20, position: [-179, 2] }] },
    { id: 'b', vesselId: 'v', samples: [{ time: 30, position: [-179, 2] }, { time: 40, position: [179, 0] }] },
    { id: 'single', vesselId: 'v', samples: [{ time: 50, position: [0, 0] }] },
  ],
}
const view: FleetView = { time: 15, size: { width: 360, height: 300 }, camera: { longitude: 0, latitude: 0, zoom: 1 }, visible: new Set(['cargo']), selected: null }

describe('GPU fleet geometry', () => {
  it('splits both dateline directions without connecting reception gaps or single samples', () => {
    const edges = packFleetEdges(study)
    expect(Array.from(edges)).toEqual([
      179, 0, 10, 180, 1, 15, 0,
      -180, 1, 15, -179, 2, 20, 0,
      -179, 2, 30, -180, 1, 35, 1,
      180, 1, 35, 179, 0, 40, 1,
    ])
    for (let i = 0; i < edges.length; i += EDGE_FLOATS) expect(Math.abs(edges[i + 3] - edges[i])).toBeLessThanOrEqual(180)
  })
  it('does not create zero-duration edges when a sample lies exactly on the seam', () => {
    const seam = { ...study, segments: [{ ...study.segments[0], samples: [{ time: 10, position: [180, 0] as const }, { time: 20, position: [-179, 2] as const }] }] }
    expect(Array.from(packFleetEdges(seam))).toEqual([-180, 0, 10, -179, 2, 20, 0])
  })
  it('retains exact segment timing, single samples, class filtering and selected state', () => {
    const heads = new FleetHeads(study)
    heads.update({ ...view, selected: 'v' })
    expect(Array.from(heads.data.slice(0, 4))).toEqual([-180, 1, 1, 1])
    expect(heads.update({ ...view, time: 25 })).toBe(0)
    expect(heads.update({ ...view, time: 50 })).toBeGreaterThan(0)
    expect(heads.update({ ...view, time: 50.001 })).toBe(0)
    expect(heads.update({ ...view, visible: new Set() })).toBe(0)
  })
  it('picks the current mark and its wrapped copy, never a stale position in a gap', () => {
    const heads = new FleetHeads(study)
    expect(heads.pick({ ...view, time: 50 }, 180, 150)).toBe('v')
    expect(heads.pick({ ...view, time: 50 }, 504, 150)).toBe('v')
    expect(heads.pick({ ...view, time: 25 }, 180, 150)).toBeNull()
    expect(heads.pick({ ...view, time: 50, visible: new Set() }, 180, 150)).toBeNull()
  })
})
