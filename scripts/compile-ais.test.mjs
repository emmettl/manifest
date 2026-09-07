import { describe, expect, it } from 'vitest'
import { compileReports } from './compile-ais.mjs'

const epoch = Date.parse('2026-01-01T00:00:00Z') / 1000
const report = (seconds, longitude = 0, latitude = 0) => ({ mmsi: '123456789', timestamp: epoch + seconds, longitude, latitude })
const input = reports => ({ source: { id: 'test', label: 'Test source', license: 'test-only' }, startUtc: '2026-01-01T00:00:00Z', duration: 86400, reports })

describe('regional compiler quality boundaries', () => {
  it('sorts reports and deduplicates identical receiver observations', () => {
    const result = compileReports(input([report(3600, .1), report(0), report(0)]))
    expect(result.segments[0].samples.map(item => item.time)).toEqual([0, 3600])
    expect(result.audit.duplicates).toBe(1)
  })
  it('breaks on a reception gap rather than inventing continuity', () => {
    const result = compileReports(input([report(0), report(60, .01), report(25000, .1), report(26000, .11)]))
    expect(result.segments.map(item => item.samples.length)).toEqual([2, 2])
    expect(result.audit.gapSplits).toBe(1)
  })
  it('breaks on an impossible jump', () => {
    const result = compileReports(input([report(0), report(60, 90)]))
    expect(result.audit.speedSplits).toBe(1)
    expect(result.segments).toHaveLength(2)
  })
  it('discards simultaneous conflicting locations and breaks the track', () => {
    const result = compileReports(input([report(0), report(60, .001), report(60, .002), report(120, .003)]))
    expect(result.audit.conflicts).toBe(2)
    expect(result.segments.map(item => item.samples[0].time)).toEqual([0, 120])
  })
  it('measures speed across the dateline correctly', () => {
    const result = compileReports(input([report(0, 179.9), report(3600, -179.9)]))
    expect(result.audit.speedSplits).toBe(0)
    expect(result.segments).toHaveLength(1)
  })
  it('rejects invalid coordinates, identifiers, timestamps and out-of-window reports', () => {
    const result = compileReports(input([report(0, 181), report(0, 0, 91), report(-1), report(90000), { ...report(0), mmsi: 'missing' }, { ...report(0), timestamp: NaN }]))
    expect(result.audit.rejected).toBe(6)
    expect(result.segments).toEqual([])
  })
  it('never promotes a source to public approval during compilation', () => {
    const source = input([report(0)])
    source.source.publication = 'approved'
    const result = compileReports(source)
    expect(result.source.publication).toBe('review-required')
    expect(result.audit.inputSha256).toMatch(/^[a-f0-9]{64}$/)
  })
})
